import React, { useState, useEffect, useCallback } from 'react';
import {
  GameState,
  Order,
  Negotiation,
  TradeRecord,
  PlayerTradeStats,
  OrderType,
  ResourceType,
} from '../types/game';
import { RESOURCE_CONFIG } from '../lib/gameConfig';
import { onSocket, emitSocket } from '../lib/socket';

interface AuctionPanelProps {
  gameState: GameState;
  currentPlayerId: string;
}

type AuctionTab = 'orders' | 'create' | 'history' | 'stats' | 'negotiations';
type SortField = 'price' | 'time' | 'quantity';

export const AuctionPanel: React.FC<AuctionPanelProps> = ({
  gameState,
  currentPlayerId,
}) => {
  const [activeTab, setActiveTab] = useState<AuctionTab>('orders');
  const [filterResource, setFilterResource] = useState<ResourceType | 'all'>('all');
  const [filterType, setFilterType] = useState<OrderType | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortAsc, setSortAsc] = useState(false);

  const [orderType, setOrderType] = useState<OrderType>('sell');
  const [orderResource, setOrderResource] = useState<ResourceType>('materials');
  const [orderQuantity, setOrderQuantity] = useState<string>('100');
  const [orderPriceResource, setOrderPriceResource] = useState<ResourceType>('water');
  const [orderPricePerUnit, setOrderPricePerUnit] = useState<string>('2');

  const [buyQuantity, setBuyQuantity] = useState<Record<string, string>>({});
  const [showNegotiationModal, setShowNegotiationModal] = useState<string | null>(null);
  const [negotiationPrice, setNegotiationPrice] = useState<string>('');
  const [negotiationQuantity, setNegotiationQuantity] = useState<string>('');

  const [orders, setOrders] = useState<Order[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerTradeStats>>({});
  const [notification, setNotification] = useState<string | null>(null);

  const resourceTypes = Object.keys(RESOURCE_CONFIG) as ResourceType[];
  const currentPlayer = gameState.players[currentPlayerId];

  useEffect(() => {
    if (gameState.orders) {
      setOrders(gameState.orders);
    }
    if (gameState.negotiations) {
      setNegotiations(gameState.negotiations);
    }
    if (gameState.tradeHistory) {
      setTradeHistory(gameState.tradeHistory);
    }
    if (gameState.playerTradeStats) {
      setPlayerStats(gameState.playerTradeStats);
    }
  }, [gameState]);

  useEffect(() => {
    const handleAuctionUpdate = (data: {
      orders: Order[];
      negotiations: Negotiation[];
      tradeHistory: TradeRecord[];
      playerTradeStats: Record<string, PlayerTradeStats>;
    }) => {
      setOrders(data.orders);
      setNegotiations(data.negotiations);
      setTradeHistory(data.tradeHistory);
      setPlayerStats(data.playerTradeStats);
    };

    const handleTradeExecuted = (trade: TradeRecord) => {
      showNotification(`交易成功: ${trade.quantity} ${RESOURCE_CONFIG[trade.resourceType].name} × ${trade.pricePerUnit} ${RESOURCE_CONFIG[trade.priceResource].name}`);
    };

    const handleNegotiationUpdate = (negotiation: Negotiation) => {
      if (negotiation.initiatorPlayerId === currentPlayerId || negotiation.targetPlayerId === currentPlayerId) {
        if (negotiation.status === 'accepted') {
          showNotification('议价成功！交易已完成');
        } else if (negotiation.status === 'rejected') {
          showNotification('议价被拒绝');
        } else if (negotiation.status === 'timeout') {
          showNotification('议价超时');
        }
      }
    };

    const unsub1 = onSocket('auction:updated', handleAuctionUpdate);
    const unsub2 = onSocket('auction:trade-executed', handleTradeExecuted);
    const unsub3 = onSocket('auction:negotiation-updated', handleNegotiationUpdate);

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [currentPlayerId]);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleCreateOrder = useCallback(() => {
    const quantity = parseInt(orderQuantity);
    const pricePerUnit = parseFloat(orderPricePerUnit);

    if (!quantity || quantity <= 0) {
      alert('请输入有效的数量');
      return;
    }
    if (!pricePerUnit || pricePerUnit <= 0) {
      alert('请输入有效的单价');
      return;
    }
    if (orderResource === orderPriceResource) {
      alert('交易资源和计价资源不能相同');
      return;
    }

    emitSocket('auction:create-order', {
      type: orderType,
      resourceType: orderResource,
      quantity,
      priceResource: orderPriceResource,
      pricePerUnit,
    }, (result: any) => {
      if (result?.success) {
        showNotification(`${orderType === 'sell' ? '卖' : '买'}单已创建`);
        setOrderQuantity('100');
        setOrderPricePerUnit('2');
        setActiveTab('orders');
      } else {
        alert(result?.error || '创建失败');
      }
    });
  }, [orderType, orderResource, orderQuantity, orderPriceResource, orderPricePerUnit, showNotification]);

  const handleCancelOrder = useCallback((orderId: string) => {
    if (!confirm('确定要撤销这个挂单吗？')) return;

    emitSocket('auction:cancel-order', { orderId }, (result: any) => {
      if (result?.success) {
        showNotification('挂单已撤销');
      } else {
        alert(result?.error || '撤销失败');
      }
    });
  }, [showNotification]);

  const handleFillOrder = useCallback((orderId: string) => {
    const quantity = parseInt(buyQuantity[orderId] || '0');
    if (!quantity || quantity <= 0) {
      alert('请输入有效的购买数量');
      return;
    }

    emitSocket('auction:fill-order', { orderId, quantity }, (result: any) => {
      if (result?.success) {
        showNotification('购买成功！');
        setBuyQuantity(prev => ({ ...prev, [orderId]: '' }));
      } else {
        alert(result?.error || '购买失败');
      }
    });
  }, [buyQuantity, showNotification]);

  const handleStartNegotiation = useCallback((order: Order) => {
    const quantity = parseInt(negotiationQuantity || order.remainingQuantity.toString());
    const pricePerUnit = parseFloat(negotiationPrice || order.pricePerUnit.toString());

    if (!quantity || quantity <= 0) {
      alert('请输入有效的数量');
      return;
    }
    if (!pricePerUnit || pricePerUnit <= 0) {
      alert('请输入有效的单价');
      return;
    }

    emitSocket('auction:start-negotiation', {
      orderId: order.id,
      quantity,
      pricePerUnit,
    }, (result: any) => {
      if (result?.success) {
        showNotification('议价已发起，等待对方回应');
        setShowNegotiationModal(null);
        setNegotiationPrice('');
        setNegotiationQuantity('');
      } else {
        alert(result?.error || '发起议价失败');
      }
    });
  }, [negotiationQuantity, negotiationPrice, showNotification]);

  const handleMakeOffer = useCallback((negotiationId: string) => {
    const quantity = parseInt(negotiationQuantity || '0');
    const pricePerUnit = parseFloat(negotiationPrice || '0');

    if (!quantity || quantity <= 0) {
      alert('请输入有效的数量');
      return;
    }
    if (!pricePerUnit || pricePerUnit <= 0) {
      alert('请输入有效的单价');
      return;
    }

    emitSocket('auction:make-offer', {
      negotiationId,
      quantity,
      pricePerUnit,
    }, (result: any) => {
      if (result?.success) {
        showNotification('出价已发送');
        setNegotiationPrice('');
        setNegotiationQuantity('');
      } else {
        alert(result?.error || '出价失败');
      }
    });
  }, [negotiationQuantity, negotiationPrice, showNotification]);

  const handleRespondNegotiation = useCallback((negotiationId: string, accept: boolean) => {
    emitSocket('auction:respond-negotiation', {
      negotiationId,
      accept,
    }, (result: any) => {
      if (result?.success) {
        showNotification(accept ? '已接受议价' : '已拒绝议价');
      } else {
        alert(result?.error || '操作失败');
      }
    });
  }, [showNotification]);

  const filteredOrders = orders
    .filter(o => {
      if (filterResource !== 'all' && o.resourceType !== filterResource) return false;
      if (filterType !== 'all' && o.type !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortField === 'price') {
        return sortAsc ? a.pricePerUnit - b.pricePerUnit : b.pricePerUnit - a.pricePerUnit;
      } else if (sortField === 'time') {
        return sortAsc ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
      } else {
        return sortAsc ? a.remainingQuantity - b.remainingQuantity : b.remainingQuantity - a.remainingQuantity;
      }
    });

  const myOrders = orders.filter(o => o.playerId === currentPlayerId && o.status === 'active');
  const myNegotiations = negotiations.filter(
    n => n.status === 'pending' &&
      (n.initiatorPlayerId === currentPlayerId || n.targetPlayerId === currentPlayerId)
  );
  const myStats = playerStats[currentPlayerId];

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getOrderActionLabel = (order: Order) => {
    if (order.type === 'sell') {
      return currentPlayerId === order.playerId ? '撤销' : '购买';
    } else {
      return currentPlayerId === order.playerId ? '撤销' : '出售';
    }
  };

  return (
    <div className="panel rounded-xl p-4 max-h-[70vh] overflow-y-auto">
      {notification && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
          {notification}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-mars-400">🏪 星际交易所</h3>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {(['orders', 'create', 'negotiations', 'history', 'stats'] as AuctionTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-mars-600 text-white'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
          >
            {tab === 'orders' && '📋 挂单列表'}
            {tab === 'create' && '➕ 创建挂单'}
            {tab === 'negotiations' && `💬 议价${myNegotiations.length > 0 ? ` (${myNegotiations.length})` : ''}`}
            {tab === 'history' && '📜 交易历史'}
            {tab === 'stats' && '📊 我的统计'}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <select
              value={filterResource}
              onChange={(e) => setFilterResource(e.target.value as ResourceType | 'all')}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
            >
              <option value="all">全部资源</option>
              {resourceTypes.map(res => (
                <option key={res} value={res}>
                  {RESOURCE_CONFIG[res].icon} {RESOURCE_CONFIG[res].name}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as OrderType | 'all')}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
            >
              <option value="all">全部类型</option>
              <option value="sell">卖单</option>
              <option value="buy">买单</option>
            </select>

            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
            >
              <option value="time">按时间</option>
              <option value="price">按单价</option>
              <option value="quantity">按数量</option>
            </select>

            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
            >
              {sortAsc ? '↑ 升序' : '↓ 降序'}
            </button>
          </div>

          {myOrders.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">📌 我的挂单</h4>
              <div className="space-y-2">
                {myOrders.map(order => (
                  <div key={order.id} className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${order.type === 'sell' ? 'bg-red-600/50 text-red-300' : 'bg-green-600/50 text-green-300'}`}>
                        {order.type === 'sell' ? '卖' : '买'}
                      </span>
                      <span className="text-xs text-gray-400">{formatTime(order.createdAt)}</span>
                    </div>
                    <div className="text-sm mb-2">
                      {order.type === 'sell' ? '出售' : '购买'} {order.remainingQuantity} {RESOURCE_CONFIG[order.resourceType].icon}
                      ，单价 {order.pricePerUnit} {RESOURCE_CONFIG[order.priceResource].icon}
                    </div>
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      className="w-full py-1 bg-red-600/80 hover:bg-red-500 rounded text-sm"
                    >
                      撤销挂单
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {filteredOrders.length === 0 ? (
              <div className="text-center text-gray-500 py-8">暂无挂单</div>
            ) : (
              filteredOrders.map(order => (
                <div
                  key={order.id}
                  className={`p-3 rounded-lg ${
                    order.playerId === currentPlayerId
                      ? 'bg-yellow-900/10 border border-yellow-700/30'
                      : 'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${order.type === 'sell' ? 'bg-red-600/50 text-red-300' : 'bg-green-600/50 text-green-300'}`}>
                        {order.type === 'sell' ? '卖' : '买'}
                      </span>
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                        style={{ backgroundColor: gameState.players[order.playerId]?.color || '#666' }}
                      >
                        {order.playerName.charAt(0)}
                      </span>
                      <span className="text-sm font-semibold">{order.playerName}</span>
                    </div>
                    <span className="text-xs text-gray-400">{formatTime(order.createdAt)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs">资源</div>
                      <div style={{ color: RESOURCE_CONFIG[order.resourceType].color }}>
                        {RESOURCE_CONFIG[order.resourceType].icon} {order.remainingQuantity}/{order.quantity}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">单价</div>
                      <div style={{ color: RESOURCE_CONFIG[order.priceResource].color }}>
                        {order.pricePerUnit} {RESOURCE_CONFIG[order.priceResource].icon}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">总价</div>
                      <div style={{ color: RESOURCE_CONFIG[order.priceResource].color }}>
                        {Math.ceil(order.remainingQuantity * order.pricePerUnit)} {RESOURCE_CONFIG[order.priceResource].icon}
                      </div>
                    </div>
                  </div>

                  {order.playerId !== currentPlayerId && (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={order.remainingQuantity}
                        value={buyQuantity[order.id] || ''}
                        placeholder="数量"
                        onChange={(e) => setBuyQuantity(prev => ({ ...prev, [order.id]: e.target.value }))}
                        className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                      />
                      <button
                        onClick={() => handleFillOrder(order.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm font-semibold"
                      >
                        {getOrderActionLabel(order)}
                      </button>
                      <button
                        onClick={() => {
                          setShowNegotiationModal(order.id);
                          setNegotiationQuantity(order.remainingQuantity.toString());
                          setNegotiationPrice((order.pricePerUnit * 0.8).toFixed(1));
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold"
                      >
                        议价
                      </button>
                    </div>
                  )}

                  {order.playerId === currentPlayerId && (
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      className="w-full py-1 bg-red-600/80 hover:bg-red-500 rounded text-sm"
                    >
                      撤销挂单
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">挂单类型</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOrderType('sell')}
                className={`py-2 rounded-lg font-semibold transition-colors ${
                  orderType === 'sell'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                📤 出售
              </button>
              <button
                onClick={() => setOrderType('buy')}
                className={`py-2 rounded-lg font-semibold transition-colors ${
                  orderType === 'buy'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                📥 购买
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {orderType === 'sell' ? '出售' : '购买'}资源
            </label>
            <select
              value={orderResource}
              onChange={(e) => setOrderResource(e.target.value as ResourceType)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              {resourceTypes.map(res => (
                <option key={res} value={res} disabled={res === orderPriceResource}>
                  {RESOURCE_CONFIG[res].icon} {RESOURCE_CONFIG[res].name} (当前: {currentPlayer?.resources[res] || 0})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">数量</label>
            <input
              type="number"
              min={1}
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="输入数量"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">计价资源</label>
            <select
              value={orderPriceResource}
              onChange={(e) => setOrderPriceResource(e.target.value as ResourceType)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              {resourceTypes.map(res => (
                <option key={res} value={res} disabled={res === orderResource}>
                  {RESOURCE_CONFIG[res].icon} {RESOURCE_CONFIG[res].name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              单价（每{RESOURCE_CONFIG[orderResource].name}）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0.01}
                step={0.1}
                value={orderPricePerUnit}
                onChange={(e) => setOrderPricePerUnit(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="输入单价"
              />
              <span className="text-gray-400">{RESOURCE_CONFIG[orderPriceResource].icon}</span>
            </div>
          </div>

          <div className="p-3 bg-gray-800/50 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">预计{orderType === 'sell' ? '获得' : '支付'}</div>
            <div className="text-lg font-bold" style={{ color: RESOURCE_CONFIG[orderPriceResource].color }}>
              {Math.ceil(parseInt(orderQuantity || '0') * parseFloat(orderPricePerUnit || '0'))} {RESOURCE_CONFIG[orderPriceResource].icon} {RESOURCE_CONFIG[orderPriceResource].name}
            </div>
          </div>

          <button
            onClick={handleCreateOrder}
            className="w-full btn-primary py-3 text-lg font-bold"
          >
            创建{orderType === 'sell' ? '卖' : '买'}单
          </button>
        </div>
      )}

      {activeTab === 'negotiations' && (
        <div className="space-y-3">
          {myNegotiations.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无进行中的议价</div>
          ) : (
            myNegotiations.map(negotiation => {
              const lastOffer = negotiation.offers[negotiation.offers.length - 1];
              const isMyTurn = lastOffer.playerId !== currentPlayerId;
              const timeRemaining = Math.max(0, Math.ceil((negotiation.expiresAt - Date.now()) / 1000));

              return (
                <div key={negotiation.id} className="p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-600/50 text-blue-300">
                        议价中
                      </span>
                      <span className="text-sm">
                        {negotiation.initiatorPlayerId === currentPlayerId ? '发起的' : '收到的'}
                      </span>
                    </div>
                    <div className={`text-sm font-mono ${timeRemaining < 10 ? 'text-red-400' : 'text-gray-400'}`}>
                      ⏱️ {timeRemaining}s
                    </div>
                  </div>

                  <div className="text-sm mb-3">
                    <span style={{ color: RESOURCE_CONFIG[negotiation.resourceType].color }}>
                      {RESOURCE_CONFIG[negotiation.resourceType].icon} {RESOURCE_CONFIG[negotiation.resourceType].name}
                    </span>
                    {' / '}
                    <span style={{ color: RESOURCE_CONFIG[negotiation.priceResource].color }}>
                      {RESOURCE_CONFIG[negotiation.priceResource].icon} {RESOURCE_CONFIG[negotiation.priceResource].name}
                    </span>
                    <span className="text-gray-500 ml-2">
                      第 {negotiation.currentRound}/{negotiation.maxRounds} 轮
                    </span>
                  </div>

                  <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {negotiation.offers.map((offer, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded text-xs ${
                          offer.playerId === currentPlayerId
                            ? 'bg-mars-600/20 ml-4'
                            : 'bg-gray-700/50 mr-4'
                        }`}
                      >
                        <div className="flex justify-between mb-1">
                          <span className={offer.playerId === currentPlayerId ? 'text-mars-400' : 'text-blue-400'}>
                            {offer.playerName}
                          </span>
                          <span className="text-gray-500">{formatTime(offer.timestamp)}</span>
                        </div>
                        <div>
                          数量: {offer.quantity} {RESOURCE_CONFIG[negotiation.resourceType].icon}，
                          单价: {offer.pricePerUnit} {RESOURCE_CONFIG[negotiation.priceResource].icon}，
                          总价: {Math.ceil(offer.quantity * offer.pricePerUnit)} {RESOURCE_CONFIG[negotiation.priceResource].icon}
                        </div>
                      </div>
                    ))}
                  </div>

                  {isMyTurn && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={1}
                          value={negotiationQuantity}
                          onChange={(e) => setNegotiationQuantity(e.target.value)}
                          placeholder="数量"
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        />
                        <input
                          type="number"
                          min={0.01}
                          step={0.1}
                          value={negotiationPrice}
                          onChange={(e) => setNegotiationPrice(e.target.value)}
                          placeholder="单价"
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleRespondNegotiation(negotiation.id, true)}
                          className="py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-semibold"
                        >
                          接受
                        </button>
                        <button
                          onClick={() => handleMakeOffer(negotiation.id)}
                          className="py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold"
                        >
                          还价
                        </button>
                        <button
                          onClick={() => handleRespondNegotiation(negotiation.id, false)}
                          className="py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm font-semibold"
                        >
                          拒绝
                        </button>
                      </div>
                    </div>
                  )}

                  {!isMyTurn && (
                    <div className="text-center text-yellow-400 text-sm py-2">
                      等待对方回应...
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {tradeHistory.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无交易记录</div>
          ) : (
            tradeHistory.slice().reverse().map(trade => {
              const isBuyer = trade.buyerPlayerId === currentPlayerId;
              const isSeller = trade.sellerPlayerId === currentPlayerId;

              return (
                <div
                  key={trade.id}
                  className={`p-3 rounded-lg ${
                    isBuyer
                      ? 'bg-green-900/20 border border-green-700/30'
                      : isSeller
                      ? 'bg-red-900/20 border border-red-700/30'
                      : 'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      isBuyer ? 'bg-green-600/50 text-green-300' :
                      isSeller ? 'bg-red-600/50 text-red-300' :
                      'bg-gray-600/50 text-gray-300'
                    }`}>
                      {isBuyer ? '买入' : isSeller ? '卖出' : '交易'}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(trade.timestamp)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400">{trade.buyerPlayerName}</span>
                    {' → '}
                    <span className="text-gray-400">{trade.sellerPlayerName}</span>
                    : {trade.quantity} {RESOURCE_CONFIG[trade.resourceType].icon}
                    × {trade.pricePerUnit} {RESOURCE_CONFIG[trade.priceResource].icon}
                    = {trade.totalPrice} {RESOURCE_CONFIG[trade.priceResource].icon}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'stats' && myStats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-green-900/20 rounded-lg border border-green-700/30">
              <div className="text-xs text-gray-400 mb-1">总买入</div>
              <div className="text-2xl font-bold text-green-400">{myStats.totalBought}</div>
            </div>
            <div className="p-3 bg-red-900/20 rounded-lg border border-red-700/30">
              <div className="text-xs text-gray-400 mb-1">总卖出</div>
              <div className="text-2xl font-bold text-red-400">{myStats.totalSold}</div>
            </div>
            <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-700/30">
              <div className="text-xs text-gray-400 mb-1">交易次数</div>
              <div className="text-2xl font-bold text-blue-400">{myStats.tradeCount}</div>
            </div>
            <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-700/30">
              <div className="text-xs text-gray-400 mb-1">净交易</div>
              <div className={`text-2xl font-bold ${
                (myStats.totalBought - myStats.totalSold) > 0 ? 'text-green-400' :
                (myStats.totalBought - myStats.totalSold) < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {myStats.totalBought - myStats.totalSold > 0 ? '+' : ''}
                {myStats.totalBought - myStats.totalSold}
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">💰 收支明细</h4>
            <div className="space-y-2">
              {resourceTypes.map(res => {
                const spent = myStats.totalSpent[res] || 0;
                const earned = myStats.totalEarned[res] || 0;
                const net = earned - spent;

                if (spent === 0 && earned === 0) return null;

                return (
                  <div key={res} className="flex items-center justify-between text-sm">
                    <span style={{ color: RESOURCE_CONFIG[res].color }}>
                      {RESOURCE_CONFIG[res].icon} {RESOURCE_CONFIG[res].name}
                    </span>
                    <div className="flex gap-4">
                      <span className="text-red-400">-{spent}</span>
                      <span className="text-green-400">+{earned}</span>
                      <span className={`font-bold ${net > 0 ? 'text-green-400' : net < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {net > 0 ? '+' : ''}{net}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">📦 库存变化</h4>
            <div className="space-y-2">
              {resourceTypes.map(res => {
                const pl = myStats.profitLoss[res] || 0;
                if (pl === 0) return null;

                return (
                  <div key={res} className="flex items-center justify-between text-sm">
                    <span style={{ color: RESOURCE_CONFIG[res].color }}>
                      {RESOURCE_CONFIG[res].icon} {RESOURCE_CONFIG[res].name}
                    </span>
                    <span className={`font-bold ${pl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pl > 0 ? '+' : ''}{pl}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showNegotiationModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="panel rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-mars-400">💬 发起议价</h3>

            {(() => {
              const order = orders.find(o => o.id === showNegotiationModal);
              if (!order) return null;

              return (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-800/50 rounded-lg">
                    <div className="text-sm mb-1">
                      {order.type === 'sell' ? '卖家' : '买家'}: {order.playerName}
                    </div>
                    <div className="text-sm">
                      {order.type === 'sell' ? '出售' : '购买'} {order.remainingQuantity} {RESOURCE_CONFIG[order.resourceType].icon}
                      ，单价 {order.pricePerUnit} {RESOURCE_CONFIG[order.priceResource].icon}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">议价数量</label>
                    <input
                      type="number"
                      min={1}
                      max={order.remainingQuantity}
                      value={negotiationQuantity}
                      onChange={(e) => setNegotiationQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      议价单价（{RESOURCE_CONFIG[order.priceResource].icon}）
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.1}
                      value={negotiationPrice}
                      onChange={(e) => setNegotiationPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                  </div>

                  <div className="p-3 bg-gray-800/50 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">预计总价</div>
                    <div className="text-lg font-bold" style={{ color: RESOURCE_CONFIG[order.priceResource].color }}>
                      {Math.ceil(parseInt(negotiationQuantity || '0') * parseFloat(negotiationPrice || '0'))} {RESOURCE_CONFIG[order.priceResource].icon}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowNegotiationModal(null)}
                      className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleStartNegotiation(order)}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold"
                    >
                      发起议价
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
