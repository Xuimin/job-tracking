<?php

if (! function_exists('build_postgres_url')) {
    function build_postgres_url(array $parts): string
    {
        $scheme = $parts['scheme'] ?? 'postgresql';
        $user = $parts['user'] ?? '';
        $pass = $parts['pass'] ?? '';
        $auth = '';

        if ($user !== '') {
            $auth = rawurlencode($user);
            if ($pass !== '') {
                $auth .= ':'.rawurlencode($pass);
            }
            $auth .= '@';
        }

        $host = $parts['host'] ?? 'localhost';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = $parts['path'] ?? '';
        $query = $parts['query'] ?? '';

        if ($query !== '' && ! str_contains($query, 'sslmode=')) {
            $query .= '&sslmode=require';
        } elseif ($query === '' && (env('RENDER') || env('RENDER_EXTERNAL_URL'))) {
            $query = 'sslmode=require';
        }

        $queryString = $query !== '' ? '?'.$query : '';

        return "{$scheme}://{$auth}{$host}{$port}{$path}{$queryString}";
    }
}

if (! function_exists('postgres_url_with_host')) {
    function postgres_url_with_host(string $url, string $host): string
    {
        $parts = parse_url($url);

        if ($parts === false || ! isset($parts['host'])) {
            return $url;
        }

        $parts['host'] = $host;

        return build_postgres_url($parts);
    }
}

if (! function_exists('expand_render_postgres_url')) {
    /**
     * Render internal URLs use short hosts (dpg-xxxx-a) that need private DNS.
     * Use the public hostname suffix when running on Render so migrations can connect.
     */
    function expand_render_postgres_url(string $url): string
    {
        $parts = parse_url($url);

        if ($parts === false || ! isset($parts['host'])) {
            return $url;
        }

        $host = $parts['host'];

        if (str_contains($host, '.')) {
            return $url;
        }

        if (! preg_match('/^dpg-[a-z0-9]+-a$/', $host)) {
            return $url;
        }

        if (! env('RENDER') && ! env('RENDER_EXTERNAL_URL')) {
            return $url;
        }

        $suffix = env('RENDER_POSTGRES_HOST_SUFFIX', 'singapore-postgres.render.com');
        $parts['host'] = $host.'.'.ltrim($suffix, '.');

        return build_postgres_url($parts);
    }
}

if (! function_exists('sanitized_database_url')) {
    function sanitized_database_url(): ?string
    {
        $url = env('DB_URL') ?: env('DATABASE_URL');

        if (! is_string($url)) {
            return null;
        }

        $url = preg_replace('/\s+/', '', trim($url));

        if ($url === '') {
            return null;
        }

        $overrideHost = env('PGHOST') ?: env('DB_HOST');

        if (is_string($overrideHost) && trim($overrideHost) !== '') {
            return postgres_url_with_host($url, preg_replace('/\s+/', '', trim($overrideHost)));
        }

        return expand_render_postgres_url($url);
    }
}
