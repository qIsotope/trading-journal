from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import MetaTrader5 as mt5
from datetime import datetime, timedelta

app = FastAPI(title="MT5 Sync API", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class MT5Credentials(BaseModel):
    login: int
    password: str
    server: str

class AccountInfo(BaseModel):
    login: int
    server: str
    balance: float
    equity: float
    margin: float
    margin_free: float
    profit: float
    currency: str
    leverage: int

class HistoricalTrade(BaseModel):
    deal_id: int
    ticket: int
    symbol: str
    direction: str
    volume: float
    open_price: float
    close_price: float
    stop_loss: Optional[float]
    take_profit: Optional[float]
    open_time: str
    close_time: str
    profit: float
    commission: float
    swap: float

class SyncResponse(BaseModel):
    success: bool
    account_info: AccountInfo
    trades: List[HistoricalTrade]
    trades_count: int

@app.get("/")
async def root():
    return {"message": "MT5 Sync API", "version": "2.0.0"}

@app.post("/sync-account", response_model=SyncResponse)
async def sync_account(credentials: MT5Credentials, days: int = 30):
    """
    Синхронізує дані з MT5 акаунту
    Приймає credentials, повертає інфо акаунту та історію угод
    """
    try:
        # Ініціалізація MT5
        if not mt5.initialize():
            raise HTTPException(status_code=500, detail=f"MT5 initialization failed: {mt5.last_error()}")
        
        # Авторизація
        authorized = mt5.login(
            login=credentials.login,
            password=credentials.password,
            server=credentials.server
        )
        
        if not authorized:
            mt5.shutdown()
            raise HTTPException(status_code=401, detail=f"MT5 login failed: {mt5.last_error()}")
        
        # Отримуємо інфо акаунту
        account_info = mt5.account_info()
        if account_info is None:
            mt5.shutdown()
            raise HTTPException(status_code=500, detail="Failed to get account info")
        
        account_data = AccountInfo(
            login=account_info.login,
            server=account_info.server,
            balance=account_info.balance,
            equity=account_info.equity,
            margin=account_info.margin,
            margin_free=account_info.margin_free,
            profit=account_info.profit,
            currency=account_info.currency,
            leverage=account_info.leverage
        )
        
        # Отримуємо історію угод
        to_date = datetime.now()
        from_date = to_date - timedelta(days=days)
        
        deals = mt5.history_deals_get(from_date, to_date)
        orders = mt5.history_orders_get(from_date, to_date)
        
        # Створюємо словник orders по позиціях для швидкого доступу до SL/TP
        orders_dict = {}
        if orders:
            for order in orders:
                if order.position_id > 0:  # Якщо order пов'язаний з позицією
                    if order.position_id not in orders_dict:
                        orders_dict[order.position_id] = []
                    orders_dict[order.position_id].append(order)
        
        trades = []
        if deals and len(deals) > 0:
            # Групуємо угоди по позиціях
            positions_dict = {}
            for deal in deals:
                if deal.entry == mt5.DEAL_ENTRY_OUT:  # Closing deal
                    ticket = deal.position_id
                    if ticket not in positions_dict:
                        positions_dict[ticket] = {'close': deal}
                    else:
                        positions_dict[ticket]['close'] = deal
                elif deal.entry == mt5.DEAL_ENTRY_IN:  # Opening deal
                    ticket = deal.position_id
                    if ticket not in positions_dict:
                        positions_dict[ticket] = {'open': deal}
                    else:
                        positions_dict[ticket]['open'] = deal
            
            # Формуємо список угод
            for ticket, deals_data in positions_dict.items():
                if 'open' in deals_data and 'close' in deals_data:
                    open_deal = deals_data['open']
                    close_deal = deals_data['close']
                    
                    direction = "LONG" if open_deal.type == mt5.ORDER_TYPE_BUY else "SHORT"
                    
                    # Отримуємо SL/TP з orders
                    sl = None
                    tp = None
                    if ticket in orders_dict:
                        # Беремо перший order (початковий вхід)
                        for order in orders_dict[ticket]:
                            if order.type in [mt5.ORDER_TYPE_BUY, mt5.ORDER_TYPE_SELL]:
                                sl = order.sl if order.sl != 0.0 else None
                                tp = order.tp if order.tp != 0.0 else None
                                break
                    
                    trades.append(HistoricalTrade(
                        deal_id=close_deal.ticket,
                        ticket=ticket,
                        symbol=open_deal.symbol,
                        direction=direction,
                        volume=open_deal.volume,
                        open_price=open_deal.price,
                        close_price=close_deal.price,
                        stop_loss=sl,
                        take_profit=tp,
                        open_time=datetime.fromtimestamp(open_deal.time).isoformat(),
                        close_time=datetime.fromtimestamp(close_deal.time).isoformat(),
                        profit=close_deal.profit,
                        commission=open_deal.commission + close_deal.commission,
                        swap=close_deal.swap
                    ))
        
        # Відключаємось
        mt5.shutdown()
        
        return SyncResponse(
            success=True,
            account_info=account_data,
            trades=trades,
            trades_count=len(trades)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        if mt5.initialize():
            mt5.shutdown()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
