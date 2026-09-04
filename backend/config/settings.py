import os
from pathlib import Path
from urllib.parse import urlparse, unquote
from datetime import timedelta

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# Load backend/.env for local development only. On Railway, environment
# variables are injected natively and this file is absent, so failures are
# ignored (no-op) rather than fatal.
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')
except ImportError:
    pass

# Insecure fallback used ONLY when no DJANGO_SECRET_KEY is set (local dev).
# The production guard at the bottom refuses to boot with DEBUG=False if this
# fallback is still in use.
_INSECURE_SECRET_KEY = 'django-insecure-a4pnqx(p@n=8b2e*g_fezhc8z&-_r!%ebmu$w7(-6n_uu1v$_$'

# --- Security ---
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', _INSECURE_SECRET_KEY)

# DEBUG defaults to True for local dev. Railway sets DJANGO_DEBUG=False.
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').strip().lower() in ('1', 'true', 'yes', 'on')

ALLOWED_HOSTS = [h.strip() for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'core',
    'donors',
    'departments',
    'requests_app',
    'donations',
    'inventory',
    'issuance',
    'reports',
    'forecasting',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


def _parse_database_url(url):
    """Turn a postgres:// / postgresql:// URL into a Django DATABASES entry.
    Dependency-free so it stays viva-explainable. urlparse handles
    percent-encoded passwords, which Railway generates."""
    parsed = urlparse(url)
    if parsed.scheme not in ('postgres', 'postgresql'):
        raise ImproperlyConfigured(
            f"Unsupported DATABASE_URL scheme: {parsed.scheme!r}. "
            "Expected postgres:// or postgresql:// (Railway PostgreSQL)."
        )
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': parsed.path.lstrip('/') or 'railway',
        'USER': unquote(parsed.username or ''),
        'PASSWORD': unquote(parsed.password or ''),
        'HOST': parsed.hostname or 'localhost',
        'PORT': str(parsed.port or '5432'),
    }


# Prefer PostgreSQL when Railway injects DATABASE_URL; otherwise keep SQLite so
# local development is unchanged.
_DATABASE_URL = os.environ.get('DATABASE_URL')
if _DATABASE_URL:
    DATABASES = {'default': _parse_database_url(_DATABASE_URL)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Karachi'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
# Directory that `collectstatic` gathers all static files into for production.
# Railway's filesystem is ephemeral, but collectstatic runs at build/start time
# and WhiteNoise serves from here — this is the standard Railway pattern.
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'core.CustomUser'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
        'user': '1000/day',
    },
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

_DEFAULT_CORS = 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5174'
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', _DEFAULT_CORS).split(',') if o.strip()]


# --- Production guard -------------------------------------------------------
# When DEBUG is False we assume this is a deployed instance and harden the
# config. Crucially, refuse to boot if the insecure fallback key is still in
# use, so a forgotten DJANGO_SECRET_KEY on Railway can never go live silently.
if not DEBUG:
    if SECRET_KEY == _INSECURE_SECRET_KEY:
        raise ImproperlyConfigured(
            'DJANGO_SECRET_KEY must be set in the environment when DEBUG=False. '
            'Refusing to start with the insecure development key.'
        )

    # Railway terminates TLS at its edge proxy and forwards X-Forwarded-Proto.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60  # short window; safe for a demo, avoids lock-in
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_SSL_REDIRECT = False  # Railway already redirects; avoid redirect loops

    # CSRF must trust the frontend origin over HTTPS too.
    CSRF_TRUSTED_ORIGINS = [
        o for o in CORS_ALLOWED_ORIGINS if o.startswith('https://')
    ]
