<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobApplication extends Model
{
    public const STATUSES = ['wishlist', 'applied', 'interview', 'offer', 'rejected'];

    // user_id is only ever set server-side (never validated from request input)
    protected $fillable = ['user_id', 'company', 'position', 'status', 'location', 'salary', 'url', 'applied_on', 'notes'];

    protected $hidden = ['user_id'];

    protected $casts = ['applied_on' => 'date:Y-m-d'];
}
