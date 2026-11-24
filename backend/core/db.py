"""Capa de datos: único punto de acceso a PostgreSQL (DATABASE_URL)."""
import json
import os
from contextlib import asynccontextmanager

import asyncpg

_pool = None


async def _init_conn(conn):
    for t in ("json", "jsonb"):
        await conn.set_type_codec(t, encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def init_pool():
    global _pool
    _pool = await asyncpg.create_pool(os.environ["DATABASE_URL"], min_size=1, max_size=10, init=_init_conn)


@asynccontextmanager
async def transaccion():
    async with _pool.acquire() as c:
        async with c.transaction():
            yield c


async def close_pool():
    if _pool:
        await _pool.close()


def pool():
    return _pool


async def fetch(sql, *args):
    async with _pool.acquire() as c:
        return [dict(r) for r in await c.fetch(sql, *args)]


async def fetchrow(sql, *args):
    async with _pool.acquire() as c:
        r = await c.fetchrow(sql, *args)
        return dict(r) if r else None


async def fetchval(sql, *args):
    async with _pool.acquire() as c:
        return await c.fetchval(sql, *args)


async def execute(sql, *args):
    async with _pool.acquire() as c:
        return await c.execute(sql, *args)
