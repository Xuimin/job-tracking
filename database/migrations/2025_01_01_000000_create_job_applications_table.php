<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('job_applications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete(); // each row belongs to one user
            $t->string('company');
            $t->string('position');
            $t->string('status')->default('applied')->index();
            $t->string('location')->nullable();
            $t->string('salary')->nullable();
            $t->string('url')->nullable();
            $t->date('applied_on')->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_applications');
    }
};
