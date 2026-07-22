from loguru import logger
import sys

logger.remove()
logger.add(
    sys.stdout,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} — {message}",
    level="INFO",
    colorize=True,
)

# Separate error file for production debugging
logger.add(
    "logs/errors.log",
    level="ERROR",
    rotation="10 MB",
    retention="7 days",
)
