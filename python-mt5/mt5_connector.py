import MetaTrader5 as mt5
from datetime import datetime
import os
from dotenv import load_dotenv

# Завантажуємо змінні з .env файлу
load_dotenv()

class MT5Connector:
    def __init__(self):
        self.login = int(os.getenv('MT5_LOGIN'))
        self.password = os.getenv('MT5_PASSWORD')
        self.server = os.getenv('MT5_SERVER')
        self.connected = False

    def connect(self):
        """Підключення до MT5"""
        # Ініціалізуємо MT5
        if not mt5.initialize():
            print(f"❌ Помилка ініціалізації MT5: {mt5.last_error()}")
            return False
        
        # Авторизація
        authorized = mt5.login(
            login=self.login,
            password=self.password,
            server=self.server
        )
        
        if authorized:
            print(f"✅ Успішно підключено до MT5")
            print(f"📊 Акаунт: {self.login}")
            print(f"🏢 Сервер: {self.server}")
            self.connected = True
            return True
        else:
            print(f"❌ Помилка авторизації: {mt5.last_error()}")
            mt5.shutdown()
            return False

    def get_account_info(self):
        """Отримати інформацію про акаунт"""
        if not self.connected:
            print("❌ Спочатку підключіться до MT5")
            return None
        
        account_info = mt5.account_info()
        if account_info is None:
            print(f"❌ Помилка отримання інфо: {mt5.last_error()}")
            return None
        
        info_dict = account_info._asdict()
        print("\n💼 Інформація про акаунт:")
        print(f"  Баланс: ${info_dict['balance']:.2f}")
        print(f"  Equity: ${info_dict['equity']:.2f}")
        print(f"  Маржа: ${info_dict['margin']:.2f}")
        print(f"  Вільна маржа: ${info_dict['margin_free']:.2f}")
        print(f"  Прибуток: ${info_dict['profit']:.2f}")
        
        return info_dict

    def get_open_positions(self):
        """Отримати відкриті позиції"""
        if not self.connected:
            print("❌ Спочатку підключіться до MT5")
            return []
        
        positions = mt5.positions_get()
        
        if positions is None:
            print(f"❌ Помилка отримання позицій: {mt5.last_error()}")
            return []
        
        if len(positions) == 0:
            print("\n📭 Немає відкритих позицій")
            return []
        
        print(f"\n📈 Відкриті позиції ({len(positions)}):")
        print("-" * 100)
        
        positions_list = []
        for position in positions:
            pos_dict = position._asdict()
            positions_list.append(pos_dict)
            
            pos_type = "BUY" if pos_dict['type'] == 0 else "SELL"
            profit_emoji = "🟢" if pos_dict['profit'] > 0 else "🔴" if pos_dict['profit'] < 0 else "⚪"
            
            print(f"{profit_emoji} {pos_dict['symbol']:<10} | {pos_type:<4} | "
                  f"Обсяг: {pos_dict['volume']:.2f} | "
                  f"Ціна відкриття: {pos_dict['price_open']:.5f} | "
                  f"Поточна: {pos_dict['price_current']:.5f} | "
                  f"Прибуток: ${pos_dict['profit']:.2f}")
        
        print("-" * 100)
        return positions_list

    def get_history_deals(self, days=7):
        """Отримати історію угод за останні N днів"""
        if not self.connected:
            print("❌ Спочатку підключіться до MT5")
            return []
        
        from datetime import datetime, timedelta
        
        # Дата з якої починаємо
        date_from = datetime.now() - timedelta(days=days)
        date_to = datetime.now()
        
        deals = mt5.history_deals_get(date_from, date_to)
        
        if deals is None:
            print(f"❌ Помилка отримання історії: {mt5.last_error()}")
            return []
        
        if len(deals) == 0:
            print(f"\n📭 Немає угод за останні {days} днів")
            return []
        
        print(f"\n📜 Історія угод за останні {days} днів ({len(deals)} угод):")
        print("-" * 120)
        
        deals_list = []
        for deal in deals:
            deal_dict = deal._asdict()
            deals_list.append(deal_dict)
            
            deal_type = "BUY" if deal_dict['type'] == 0 else "SELL"
            time_str = datetime.fromtimestamp(deal_dict['time']).strftime('%Y-%m-%d %H:%M:%S')
            
            print(f"🕐 {time_str} | {deal_dict['symbol']:<10} | {deal_type:<4} | "
                  f"Обсяг: {deal_dict['volume']:.2f} | "
                  f"Ціна: {deal_dict['price']:.5f} | "
                  f"Прибуток: ${deal_dict['profit']:.2f} | "
                  f"Комісія: ${deal_dict['commission']:.2f}")
        
        print("-" * 120)
        return deals_list

    def disconnect(self):
        """Відключення від MT5"""
        if self.connected:
            mt5.shutdown()
            print("\n👋 Відключено від MT5")
            self.connected = False


def main():
    """Головна функція для тестування"""
    print("🚀 Запуск MT5 Connector")
    print("=" * 100)
    
    # Створюємо connector
    connector = MT5Connector()
    
    # Підключаємося
    if not connector.connect():
        return
    
    try:
        # Отримуємо інфо про акаунт
        connector.get_account_info()
        
        # Отримуємо відкриті позиції
        connector.get_open_positions()
        
        # Отримуємо історію угод за 7 днів
        connector.get_history_deals(days=7)
        
    finally:
        # Завжди відключаємося
        connector.disconnect()


if __name__ == "__main__":
    main()
