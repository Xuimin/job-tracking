<?php

if (! function_exists('sanitized_database_url')) {
    /**
     * DATABASE_URL must be one line; pasted URLs sometimes include line breaks in the host.
     */
    function sanitized_database_url(): ?string
    {
        $url = env('DB_URL') ?: env('DATABASE_URL');

        if (! is_string($url)) {
            return null;
        }

        $url = preg_replace('/\s+/', '', trim($url));

        return $url !== '' ? $url : null;
    }
}
