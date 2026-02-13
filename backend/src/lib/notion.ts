import { Client } from '@notionhq/client';

interface NotionTradeInput {
  accountId: string;
  accountName?: string | null;
  trade: {
    deal_id: number;
    ticket: number;
    symbol: string;
    direction: string;
    volume: number;
    open_price: number;
    close_price: number;
    stop_loss: number | null;
    take_profit: number | null;
    open_time: string | number;
    close_time: string | number | null;
    weekday?: string;
    session?: string;
    date?: string;
    result?: string;
    risk_percent?: number | null;
    risk_reward?: number | null;
    profit: number;
    commission: number;
    swap: number;
  };
}

const notionApiKey = process.env.NOTION_API_KEY;
const notionDatabaseId = process.env.NOTION_DATABASE_ID;
const notion = notionApiKey ? new Client({ auth: notionApiKey }) : null;

const getProp = (envKey: string, fallback?: string) => process.env[envKey] || fallback || '';

const propTitle = getProp('NOTION_TITLE_PROP', 'Name');
const propDirection = getProp('NOTION_PROP_DIRECTION');
const propOpenTime = getProp('NOTION_PROP_OPEN_TIME');
const propCloseTime = getProp('NOTION_PROP_CLOSE_TIME');
const propProfit = getProp('NOTION_PROP_PROFIT');
const propCommission = getProp('NOTION_PROP_COMMISSION');
const propSwap = getProp('NOTION_PROP_SWAP');
const propAccount = getProp('NOTION_PROP_ACCOUNT');
const propWeekday = getProp('NOTION_PROP_WEEKDAY');
const propSession = getProp('NOTION_PROP_SESSION');
const propDate = getProp('NOTION_PROP_DATE');
const propResult = getProp('NOTION_PROP_RESULT');
const propRiskReward = getProp('NOTION_PROP_RISK_REWARD');
const propRiskPercent = getProp('NOTION_PROP_RISK_PERCENT');

const titleForTrade = (trade: NotionTradeInput['trade']) => trade.symbol;

const addNumberProp = (props: Record<string, unknown>, prop: string, value: number | null | undefined) => {
  if (!prop || value === null || value === undefined) return;
  props[prop] = { number: value };
};

const addTextProp = (props: Record<string, unknown>, prop: string, value: string | number | null | undefined) => {
  if (!prop || value === null || value === undefined) return;
  props[prop] = { rich_text: [{ text: { content: String(value) } }] };
};

const addSelectProp = (props: Record<string, unknown>, prop: string, value: string | null | undefined) => {
  if (!prop || !value) return;
  props[prop] = { select: { name: value } };
};

const addDateProp = (props: Record<string, unknown>, prop: string, value: string | number | null | undefined) => {
  if (!prop || value === null || value === undefined) return;
  if (typeof value !== 'string') return;
  props[prop] = { date: { start: value } };
};

export async function createNotionTradePage(input: NotionTradeInput): Promise<string | null> {
  if (!notion || !notionDatabaseId) return null;

  const { trade, accountName } = input;
  const properties: Record<string, any> = {
    [propTitle]: {
      title: [{ text: { content: titleForTrade(trade) } }],
    },
  };

  addSelectProp(properties, propDirection, trade.direction);
  addDateProp(properties, propOpenTime, trade.open_time);
  addDateProp(properties, propCloseTime, trade.close_time);
  addNumberProp(properties, propProfit, trade.profit);
  addNumberProp(properties, propCommission, trade.commission);
  addNumberProp(properties, propSwap, trade.swap);
  addTextProp(properties, propAccount, accountName || input.accountId);
  addTextProp(properties, propWeekday, trade.weekday);
  addSelectProp(properties, propSession, trade.session);
  addDateProp(properties, propDate, trade.date);
  addSelectProp(properties, propResult, trade.result);
  addNumberProp(properties, propRiskReward, trade.risk_reward ?? undefined);
  addNumberProp(properties, propRiskPercent, trade.risk_percent ?? undefined);

  const response = await notion.pages.create({
    parent: { database_id: notionDatabaseId },
    properties: properties as any,
  });

  return response.id || null;
}

export async function fetchNotionDatabase(pageSize = 5) {
  const notionAny = notion as any;
  let response: any;

  if (notionAny.databases?.query) {
    response = await notionAny.databases.query({
      database_id: notionDatabaseId,
      page_size: pageSize,
    });
  } else {
    response = await notionAny.request({
      method: 'POST',
      path: `/databases/${notionDatabaseId}/query`,
      body: { page_size: pageSize },
    });
  }

  return response?.results ?? [];
}
