<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * Session (cookie) authentication. React is served by this same Laravel app,
 * so the normal web guard + CSRF protection is all we need (no tokens in JS).
 */
class AuthController extends Controller
{
    // Returns {user: null} for guests instead of a 401, so the SPA can check state on load.
    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->present($request->user())]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email|max:255|unique:users,email',
            'password' => ['required', Password::min(8)],
        ]);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => strtolower($data['email']),
            'password' => Hash::make($data['password']),
        ]);

        Auth::login($user);
        $request->session()->regenerate(); // prevents session fixation

        return response()->json(['user' => $this->present($user)]);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt(['email' => strtolower($credentials['email']), 'password' => $credentials['password']])) {
            // Same message for unknown email and wrong password: don't reveal which accounts exist
            throw ValidationException::withMessages(['email' => 'Invalid email or password.']);
        }

        $request->session()->regenerate();

        return response()->json(['user' => $this->present($request->user())]);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    private function present(?User $user): ?array
    {
        return $user ? ['id' => $user->id, 'name' => $user->name, 'email' => $user->email] : null;
    }
}
