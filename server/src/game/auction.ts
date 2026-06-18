import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  Player,
  Order,
  OrderType,
  Negotiation,
  NegotiationOffer,
  TradeRecord,
  PlayerTradeStats,
  ResourceType,
} from '../types/game';
import { addResources, subtractResources, hasEnoughResources, createEmptyResources } from './resources';

const ORDER_EXPIRY_MS = 24 * 60 * 60 * 1000;
const NEGOTIATION_TIMEOUT_MS = 30 * 1000;
const MAX_NEGOTIATION_ROUNDS = 3;
const MAX_TRADE_HISTORY = 50;

function createInitialPlayerTradeStats(): PlayerTradeStats {
  return {
    totalBought: 0,
    totalSold: 0,
    totalSpent: {},
    totalEarned: {},
    tradeCount: 0,
    profitLoss: {},
  };
}

function getOrCreatePlayerStats(state: GameState, playerId: string): PlayerTradeStats {
  if (!state.playerTradeStats[playerId]) {
    state.playerTradeStats[playerId] = createInitialPlayerTradeStats();
  }
  return state.playerTradeStats[playerId];
}

export function createOrder(
  state: GameState,
  playerId: string,
  type: OrderType,
  resourceType: ResourceType,
  quantity: number,
  priceResource: ResourceType,
  pricePerUnit: number
): { success: boolean; order?: Order; error?: string } {
  const player = state.players[playerId];
  if (!player) {
    return { success: false, error: '玩家不存在' };
  }

  if (quantity <= 0) {
    return { success: false, error: '数量必须大于0' };
  }

  if (pricePerUnit <= 0) {
    return { success: false, error: '单价必须大于0' };
  }

  if (resourceType === priceResource) {
    return { success: false, error: '交易资源和计价资源不能相同' };
  }

  const totalPrice = Math.ceil(quantity * pricePerUnit);

  if (type === 'sell') {
    if (!hasEnoughResources(player.resources, { [resourceType]: quantity } as any)) {
      return { success: false, error: `${resourceType}资源不足` };
    }
    player.resources = subtractResources(player.resources, { [resourceType]: quantity } as any);
  } else {
    if (!hasEnoughResources(player.resources, { [priceResource]: totalPrice } as any)) {
      return { success: false, error: `${priceResource}资源不足` };
    }
    player.resources = subtractResources(player.resources, { [priceResource]: totalPrice } as any);
  }

  const order: Order = {
    id: uuidv4(),
    playerId,
    playerName: player.name,
    type,
    resourceType,
    quantity,
    remainingQuantity: quantity,
    priceResource,
    pricePerUnit,
    status: 'active',
    createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
  };

  state.orders.push(order);

  return { success: true, order };
}

export function cancelOrder(
  state: GameState,
  orderId: string,
  playerId: string
): { success: boolean; order?: Order; error?: string } {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: '挂单不存在' };
  }

  if (order.playerId !== playerId) {
    return { success: false, error: '只能取消自己的挂单' };
  }

  if (order.status !== 'active') {
    return { success: false, error: '挂单状态无效' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { success: false, error: '玩家不存在' };
  }

  const frozenAmount = order.type === 'sell'
    ? { [order.resourceType]: order.remainingQuantity }
    : { [order.priceResource]: Math.ceil(order.remainingQuantity * order.pricePerUnit) };

  player.resources = addResources(player.resources, frozenAmount as any);

  order.status = 'cancelled';

  return { success: true, order };
}

export function fillOrder(
  state: GameState,
  orderId: string,
  buyerPlayerId: string,
  quantity: number
): { success: boolean; tradeRecord?: TradeRecord; error?: string } {
  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { success: false, error: '该挂单已被他人买走或已撤销' };
  }

  const order = state.orders[orderIndex];

  if (order.status !== 'active') {
    return { success: false, error: '该挂单已被他人买走或已撤销' };
  }

  if (order.playerId === buyerPlayerId) {
    return { success: false, error: '不能购买自己的挂单' };
  }

  if (quantity <= 0) {
    return { success: false, error: '购买数量必须大于0' };
  }

  if (quantity > order.remainingQuantity) {
    return { success: false, error: `购买数量不能超过剩余数量 ${order.remainingQuantity}` };
  }

  const buyer = state.players[buyerPlayerId];
  const seller = state.players[order.playerId];

  if (!buyer || !seller) {
    return { success: false, error: '玩家不存在' };
  }

  const totalPrice = Math.ceil(quantity * order.pricePerUnit);

  if (order.type === 'sell') {
    if (!hasEnoughResources(buyer.resources, { [order.priceResource]: totalPrice } as any)) {
      return { success: false, error: `${order.priceResource}资源不足` };
    }

    buyer.resources = subtractResources(buyer.resources, { [order.priceResource]: totalPrice } as any);
    buyer.resources = addResources(buyer.resources, { [order.resourceType]: quantity } as any);

    seller.resources = addResources(seller.resources, { [order.priceResource]: totalPrice } as any);
  } else {
    if (!hasEnoughResources(buyer.resources, { [order.resourceType]: quantity } as any)) {
      return { success: false, error: `${order.resourceType}资源不足` };
    }

    buyer.resources = subtractResources(buyer.resources, { [order.resourceType]: quantity } as any);
    buyer.resources = addResources(buyer.resources, { [order.priceResource]: totalPrice } as any);

    const remainingPrice = Math.ceil((order.remainingQuantity - quantity) * order.pricePerUnit);
    const refundPrice = Math.ceil(quantity * order.pricePerUnit);
    seller.resources = addResources(seller.resources, { [order.resourceType]: quantity } as any);
    seller.resources = subtractResources(seller.resources, { [order.priceResource]: refundPrice } as any);
  }

  order.remainingQuantity -= quantity;

  if (order.remainingQuantity <= 0) {
    order.status = 'filled';
  }

  const tradeRecord: TradeRecord = {
    id: uuidv4(),
    buyerPlayerId: order.type === 'sell' ? buyerPlayerId : order.playerId,
    buyerPlayerName: order.type === 'sell' ? buyer.name : seller.name,
    sellerPlayerId: order.type === 'sell' ? order.playerId : buyerPlayerId,
    sellerPlayerName: order.type === 'sell' ? seller.name : buyer.name,
    resourceType: order.resourceType,
    quantity,
    priceResource: order.priceResource,
    pricePerUnit: order.pricePerUnit,
    totalPrice,
    timestamp: Date.now(),
    orderId: order.id,
  };

  state.tradeHistory.push(tradeRecord);
  if (state.tradeHistory.length > MAX_TRADE_HISTORY) {
    state.tradeHistory = state.tradeHistory.slice(-MAX_TRADE_HISTORY);
  }

  updatePlayerStats(state, tradeRecord);

  return { success: true, tradeRecord };
}

export function startNegotiation(
  state: GameState,
  orderId: string,
  initiatorPlayerId: string,
  initialQuantity: number,
  initialPricePerUnit: number
): { success: boolean; negotiation?: Negotiation; error?: string } {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.status !== 'active') {
    return { success: false, error: '挂单不存在或已失效' };
  }

  if (order.playerId === initiatorPlayerId) {
    return { success: false, error: '不能对自己的挂单发起议价' };
  }

  const initiator = state.players[initiatorPlayerId];
  const target = state.players[order.playerId];

  if (!initiator || !target) {
    return { success: false, error: '玩家不存在' };
  }

  if (initialQuantity <= 0 || initialQuantity > order.remainingQuantity) {
    return { success: false, error: '议价数量无效' };
  }

  if (initialPricePerUnit <= 0) {
    return { success: false, error: '议价单价必须大于0' };
  }

  const existingNegotiation = state.negotiations.find(
    n => n.orderId === orderId && n.status === 'pending' &&
      (n.initiatorPlayerId === initiatorPlayerId || n.targetPlayerId === initiatorPlayerId)
  );

  if (existingNegotiation) {
    return { success: false, error: '该挂单已有进行中的议价' };
  }

  const initialOffer: NegotiationOffer = {
    playerId: initiatorPlayerId,
    playerName: initiator.name,
    quantity: initialQuantity,
    pricePerUnit: initialPricePerUnit,
    timestamp: Date.now(),
  };

  const negotiation: Negotiation = {
    id: uuidv4(),
    orderId,
    initiatorPlayerId,
    initiatorPlayerName: initiator.name,
    targetPlayerId: order.playerId,
    targetPlayerName: target.name,
    resourceType: order.resourceType,
    priceResource: order.priceResource,
    offers: [initialOffer],
    currentRound: 1,
    maxRounds: MAX_NEGOTIATION_ROUNDS,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + NEGOTIATION_TIMEOUT_MS,
    lastActionAt: Date.now(),
  };

  state.negotiations.push(negotiation);

  return { success: true, negotiation };
}

export function makeNegotiationOffer(
  state: GameState,
  negotiationId: string,
  playerId: string,
  quantity: number,
  pricePerUnit: number
): { success: boolean; negotiation?: Negotiation; error?: string } {
  const negotiation = state.negotiations.find(n => n.id === negotiationId);
  if (!negotiation) {
    return { success: false, error: '议价不存在' };
  }

  if (negotiation.status !== 'pending') {
    return { success: false, error: '议价已结束' };
  }

  if (negotiation.initiatorPlayerId !== playerId && negotiation.targetPlayerId !== playerId) {
    return { success: false, error: '无权参与此议价' };
  }

  const lastOffer = negotiation.offers[negotiation.offers.length - 1];
  if (lastOffer.playerId === playerId) {
    return { success: false, error: '等待对方回应' };
  }

  if (negotiation.currentRound >= negotiation.maxRounds) {
    return { success: false, error: '已达到最大议价轮次' };
  }

  const order = state.orders.find(o => o.id === negotiation.orderId);
  if (!order || order.status !== 'active') {
    negotiation.status = 'cancelled';
    return { success: false, error: '挂单已失效，议价取消' };
  }

  if (quantity <= 0 || quantity > order.remainingQuantity) {
    return { success: false, error: '议价数量无效' };
  }

  if (pricePerUnit <= 0) {
    return { success: false, error: '议价单价必须大于0' };
  }

  const player = state.players[playerId];
  if (!player) {
    return { success: false, error: '玩家不存在' };
  }

  const newOffer: NegotiationOffer = {
    playerId,
    playerName: player.name,
    quantity,
    pricePerUnit,
    timestamp: Date.now(),
  };

  negotiation.offers.push(newOffer);
  negotiation.currentRound++;
  negotiation.lastActionAt = Date.now();
  negotiation.expiresAt = Date.now() + NEGOTIATION_TIMEOUT_MS;

  return { success: true, negotiation };
}

export function respondToNegotiation(
  state: GameState,
  negotiationId: string,
  playerId: string,
  accept: boolean
): { success: boolean; tradeRecord?: TradeRecord; negotiation?: Negotiation; error?: string } {
  const negotiation = state.negotiations.find(n => n.id === negotiationId);
  if (!negotiation) {
    return { success: false, error: '议价不存在' };
  }

  if (negotiation.status !== 'pending') {
    return { success: false, error: '议价已结束' };
  }

  if (negotiation.initiatorPlayerId !== playerId && negotiation.targetPlayerId !== playerId) {
    return { success: false, error: '无权参与此议价' };
  }

  const lastOffer = negotiation.offers[negotiation.offers.length - 1];
  if (lastOffer.playerId === playerId) {
    return { success: false, error: '这是你发起的出价，不能回应' };
  }

  const order = state.orders.find(o => o.id === negotiation.orderId);
  if (!order || order.status !== 'active') {
    negotiation.status = 'cancelled';
    return { success: false, error: '挂单已失效，议价取消' };
  }

  if (!accept) {
    negotiation.status = 'rejected';
    negotiation.lastActionAt = Date.now();
    return { success: true, negotiation };
  }

  const orderIndex = state.orders.findIndex(o => o.id === negotiation.orderId);
  const orderRef = state.orders[orderIndex];

  const buyerPlayerId = orderRef.type === 'sell' ? lastOffer.playerId : orderRef.playerId;
  const buyer = state.players[buyerPlayerId];
  const sellerPlayerId = orderRef.type === 'sell' ? orderRef.playerId : lastOffer.playerId;
  const seller = state.players[sellerPlayerId];

  if (!buyer || !seller) {
    return { success: false, error: '玩家不存在' };
  }

  const quantity = lastOffer.quantity;
  const pricePerUnit = lastOffer.pricePerUnit;
  const totalPrice = Math.ceil(quantity * pricePerUnit);

  if (orderRef.type === 'sell') {
    if (!hasEnoughResources(buyer.resources, { [orderRef.priceResource]: totalPrice } as any)) {
      return { success: false, error: '买家资源不足' };
    }
    buyer.resources = subtractResources(buyer.resources, { [orderRef.priceResource]: totalPrice } as any);
    buyer.resources = addResources(buyer.resources, { [orderRef.resourceType]: quantity } as any);
    seller.resources = addResources(seller.resources, { [orderRef.priceResource]: totalPrice } as any);
  } else {
    if (!hasEnoughResources(seller.resources, { [orderRef.resourceType]: quantity } as any)) {
      return { success: false, error: '卖家资源不足' };
    }
    seller.resources = subtractResources(seller.resources, { [orderRef.resourceType]: quantity } as any);
    seller.resources = addResources(seller.resources, { [orderRef.priceResource]: totalPrice } as any);
    const refundPrice = Math.ceil(quantity * orderRef.pricePerUnit);
    buyer.resources = subtractResources(buyer.resources, { [orderRef.priceResource]: refundPrice } as any);
    buyer.resources = addResources(buyer.resources, { [orderRef.priceResource]: totalPrice } as any);
  }

  orderRef.remainingQuantity -= quantity;
  if (orderRef.remainingQuantity <= 0) {
    orderRef.status = 'filled';
  }

  negotiation.status = 'accepted';
  negotiation.lastActionAt = Date.now();

  const tradeRecord: TradeRecord = {
    id: uuidv4(),
    buyerPlayerId,
    buyerPlayerName: buyer.name,
    sellerPlayerId,
    sellerPlayerName: seller.name,
    resourceType: orderRef.resourceType,
    quantity,
    priceResource: orderRef.priceResource,
    pricePerUnit,
    totalPrice,
    timestamp: Date.now(),
    orderId: orderRef.id,
  };

  state.tradeHistory.push(tradeRecord);
  if (state.tradeHistory.length > MAX_TRADE_HISTORY) {
    state.tradeHistory = state.tradeHistory.slice(-MAX_TRADE_HISTORY);
  }

  updatePlayerStats(state, tradeRecord);

  return { success: true, tradeRecord, negotiation };
}

export function checkNegotiationTimeouts(state: GameState): Negotiation[] {
  const now = Date.now();
  const timedOut: Negotiation[] = [];

  for (const negotiation of state.negotiations) {
    if (negotiation.status === 'pending' && negotiation.expiresAt <= now) {
      negotiation.status = 'timeout';
      negotiation.lastActionAt = now;
      timedOut.push(negotiation);
    }
  }

  return timedOut;
}

export function checkExpiredOrders(state: GameState): Order[] {
  const now = Date.now();
  const expired: Order[] = [];

  for (const order of state.orders) {
    if (order.status === 'active' && order.expiresAt <= now) {
      const player = state.players[order.playerId];
      if (player) {
        const frozenAmount = order.type === 'sell'
          ? { [order.resourceType]: order.remainingQuantity }
          : { [order.priceResource]: Math.ceil(order.remainingQuantity * order.pricePerUnit) };
        player.resources = addResources(player.resources, frozenAmount as any);
      }
      order.status = 'cancelled';
      expired.push(order);
    }
  }

  return expired;
}

function updatePlayerStats(state: GameState, trade: TradeRecord): void {
  const buyerStats = getOrCreatePlayerStats(state, trade.buyerPlayerId);
  const sellerStats = getOrCreatePlayerStats(state, trade.sellerPlayerId);

  buyerStats.totalBought += trade.quantity;
  buyerStats.tradeCount += 1;
  buyerStats.totalSpent[trade.priceResource] = (buyerStats.totalSpent[trade.priceResource] || 0) + trade.totalPrice;
  buyerStats.profitLoss[trade.resourceType] = (buyerStats.profitLoss[trade.resourceType] || 0) + trade.quantity;
  buyerStats.profitLoss[trade.priceResource] = (buyerStats.profitLoss[trade.priceResource] || 0) - trade.totalPrice;

  sellerStats.totalSold += trade.quantity;
  sellerStats.tradeCount += 1;
  sellerStats.totalEarned[trade.priceResource] = (sellerStats.totalEarned[trade.priceResource] || 0) + trade.totalPrice;
  sellerStats.profitLoss[trade.resourceType] = (sellerStats.profitLoss[trade.resourceType] || 0) - trade.quantity;
  sellerStats.profitLoss[trade.priceResource] = (sellerStats.profitLoss[trade.priceResource] || 0) + trade.totalPrice;
}

export function getPlayerNegotiations(state: GameState, playerId: string): Negotiation[] {
  return state.negotiations.filter(
    n => n.status === 'pending' &&
      (n.initiatorPlayerId === playerId || n.targetPlayerId === playerId)
  );
}

export function getPlayerOrders(state: GameState, playerId: string): Order[] {
  return state.orders.filter(o => o.status === 'active' && o.playerId === playerId);
}
