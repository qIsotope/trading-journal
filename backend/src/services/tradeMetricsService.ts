import type { MT5Trade } from '../clients/mt5Client';

const START_BALANCE = Number(process.env.ACCOUNT_START_BALANCE || 10000);
const BE_THRESHOLD_PERCENT = Number(process.env.BE_THRESHOLD_PERCENT || 0.15);
const SL_TOLERANCE_PERCENT = Number(process.env.SL_TOLERANCE_PERCENT || 10);
const CONTRACT_SIZE_DEFAULT = Number(process.env.CONTRACT_SIZE_DEFAULT || 100000);
const TIME_OFFSET_HOURS = -2;

export interface TradeMetrics {
  weekday: string;
  session: 'ASIA' | 'FRANKFURT' | 'LONDON' | 'NEWYORK';
  riskPercent: number | null;
  riskReward: number | null;
  result: 'BE' | 'SL' | 'TP' | 'MANUAL';
  profitPercent: number | null;
  commission: number;
  date: string;
  openTimeIso: string;
  closeTimeIso: string | null;
}

const calcRiskMoney = (openPrice: number, stopLoss: number | null, volume: number) => {
  if (!stopLoss || openPrice === 0) return null;
  return Math.abs(openPrice - stopLoss) * volume * CONTRACT_SIZE_DEFAULT;
};

const getWeekdayFromTs = (ts: number, offsetHours = 0) => {
  const date = new Date((ts + offsetHours * 3600) * 1000);
  const weekdayIndex = date.getDay();
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[weekdayIndex] || 'Unknown';
};

const getSessionFromTs = (ts: number, offsetHours = 0): TradeMetrics['session'] => {
  const hour = new Date((ts + offsetHours * 3600) * 1000).getHours();
  if (hour >= 0 && hour < 9) return 'ASIA';
  if (hour >= 9 && hour < 10) return 'FRANKFURT';
  if (hour >= 10 && hour < 15) return 'LONDON';
  if (hour >= 15 && hour < 23) return 'NEWYORK';
  return 'ASIA';
};

const getDateOnlyFromTs = (ts: number, offsetHours = 0) => {
  const date = new Date((ts + offsetHours * 3600) * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatIsoFromTs = (ts: number, offsetHours = 0) => {
  const date = new Date((ts + offsetHours * 3600) * 1000);
  return date.toISOString();
};

const calcRiskPercent = (riskMoney: number | null) => {
  if (!riskMoney || START_BALANCE === 0) return null;
  return (riskMoney / START_BALANCE) * 100;
};

const calcProfitPercent = (profit: number) => {
  if (START_BALANCE === 0) return null;
  return (profit / START_BALANCE) * 100;
};

const round2 = (value: number | null) => {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
};

const getResult = (profit: number, riskMoney: number | null, profitPercent: number | null): TradeMetrics['result'] => {
  if (profitPercent !== null && Math.abs(profitPercent) <= BE_THRESHOLD_PERCENT) return 'BE';

  if (riskMoney !== null && profit < 0) {
    const tolerance = Math.abs(riskMoney) * (SL_TOLERANCE_PERCENT / 100);
    if (Math.abs(profit + riskMoney) <= tolerance) return 'SL';
  }

  if (profit > 0) return 'TP';
  return 'MANUAL';
};

const calcRiskReward = (profit: number, riskMoney: number | null, result: TradeMetrics['result']) => {
  if (result === 'BE') return 0;
  if (result === 'SL') return -1;
  if (!riskMoney || riskMoney === 0) return null;
  return profit / riskMoney;
};

export function buildTradeMetrics(trade: MT5Trade): TradeMetrics {
  const riskMoney = calcRiskMoney(trade.open_price, trade.stop_loss, trade.volume);
  const riskPercent = round2(calcRiskPercent(riskMoney));
  const profitPercent = calcProfitPercent(trade.profit);
  const result = getResult(trade.profit, riskMoney, profitPercent);
  const riskReward = round2(calcRiskReward(trade.profit, riskMoney, result));

  return {
    weekday: getWeekdayFromTs(trade.open_time, TIME_OFFSET_HOURS),
    session: getSessionFromTs(trade.open_time, TIME_OFFSET_HOURS),
    riskPercent,
    riskReward,
    result,
    profitPercent,
    commission: round2(trade.commission) ?? trade.commission,
    date: getDateOnlyFromTs(trade.open_time, TIME_OFFSET_HOURS),
    openTimeIso: formatIsoFromTs(trade.open_time, TIME_OFFSET_HOURS),
    closeTimeIso: trade.close_time ? formatIsoFromTs(trade.close_time, TIME_OFFSET_HOURS) : null,
  };
}
