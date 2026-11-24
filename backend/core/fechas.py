from datetime import datetime
from zoneinfo import ZoneInfo

TZ_AR = ZoneInfo("America/Argentina/Buenos_Aires")


def hoy_ar():
    return datetime.now(TZ_AR).date()
