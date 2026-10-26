<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#2563eb">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Job Tracker">
    <link rel="apple-touch-icon" href="/pwa-192.png">
    @if (file_exists(public_path('build/manifest.webmanifest')))
        <link rel="manifest" href="{{ asset('build/manifest.webmanifest') }}">
    @endif
    <title>Job Application Tracker</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    @viteReactRefresh
    @vite(['resources/js/app.jsx'])
</head>
<body>
    <div id="root"></div>
</body>
</html>
