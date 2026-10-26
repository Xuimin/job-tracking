<?php

namespace App\Http\Controllers;

use App\Models\JobApplication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobApplicationController extends Controller
{
    private function rules(): array
    {
        return [
            'company'    => 'required|string|max:100',
            'position'   => 'required|string|max:100',
            'status'     => 'required|in:' . implode(',', JobApplication::STATUSES),
            'location'   => 'nullable|string|max:100',
            'salary'     => 'nullable|string|max:50',
            'url'        => 'nullable|url|max:255',
            'applied_on' => 'nullable|date',
            'notes'      => 'nullable|string|max:2000',
        ];
    }

    // Every query is scoped to the logged-in user
    public function index(Request $request)
    {
        return JobApplication::where('user_id', $request->user()->id)
            ->when($request->query('q'), fn ($query, $s) => $query->where(
                fn ($w) => $w->where('company', 'like', "%{$s}%")->orWhere('position', 'like', "%{$s}%")
            ))
            ->latest()
            ->get();
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        return response()->json(JobApplication::create($data + ['user_id' => $request->user()->id]), 201);
    }

    // 'sometimes' lets the board PUT just {status} when a card is moved
    public function update(Request $request, JobApplication $application)
    {
        $this->authorizeOwner($request, $application);
        $partial = array_map(fn ($rule) => 'sometimes|' . $rule, $this->rules());
        $application->update($request->validate($partial));

        return $application;
    }

    public function destroy(Request $request, JobApplication $application)
    {
        $this->authorizeOwner($request, $application);
        $application->delete();

        return response()->noContent();
    }

    // 404 (not 403) so other users' record IDs can't even be probed
    private function authorizeOwner(Request $request, JobApplication $application): void
    {
        abort_unless($application->user_id === $request->user()->id, 404);
    }
}
