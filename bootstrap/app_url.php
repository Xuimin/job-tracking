<?php

if (! function_exists('resolved_app_url')) {
/**
 * Resolve a valid application base URL for HTTP/console bootstrap (e.g. Render).
 */
function resolved_app_url(): string
{
    foreach ([env('APP_URL'), env('RENDER_EXTERNAL_URL'), 'http://localhost'] as $candidate) {
        if (! is_string($candidate)) {
            continue;
        }

        $url = trim($candidate);

        if ($url === '' || str_starts_with($url, 'postgres://') || str_starts_with($url, 'postgresql://')) {
            continue;
        }

        if (! preg_match('#^https?://#i', $url)) {
            $url = 'https://'.$url;
        }

        $host = parse_url($url, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            continue;
        }

        if (! preg_match('/^[-a-zA-Z0-9_.]+$/', $host)) {
            continue;
        }

        return rtrim($url, '/');
    }

    return 'http://localhost';
}
}
