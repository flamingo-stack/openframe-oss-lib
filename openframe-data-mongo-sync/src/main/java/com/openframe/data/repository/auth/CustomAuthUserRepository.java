package com.openframe.data.repository.auth;

import java.time.Instant;

public interface CustomAuthUserRepository {

    void updateLastLogin(String email, String tenantId, Instant lastLogin);

    void updateImageUrl(String userId, String imageUrl);
}
