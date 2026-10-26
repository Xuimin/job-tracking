<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\JobApplicationController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'app');

// JSON endpoints live in the web group on purpose: they need the session + CSRF protection.
Route::prefix('api')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware('auth')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::apiResource('applications', JobApplicationController::class)->except('show');
    });
});
