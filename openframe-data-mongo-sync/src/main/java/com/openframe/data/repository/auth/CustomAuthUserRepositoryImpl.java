package com.openframe.data.repository.auth;

import com.openframe.data.document.auth.AuthUser;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;

public class CustomAuthUserRepositoryImpl implements CustomAuthUserRepository {

    private static final String ID_FIELD = "_id";
    private static final String EMAIL_FIELD = "email";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String LAST_LOGIN_FIELD = "lastLogin";
    private static final String IMAGE_URL_FIELD = "imageUrl";
    private static final String VERSION_FIELD = "version";

    private final MongoTemplate mongoTemplate;

    public CustomAuthUserRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void updateLastLogin(String email, String tenantId, Instant lastLogin) {
        Query query = new Query(Criteria.where(EMAIL_FIELD).is(email).and(TENANT_ID_FIELD).is(tenantId));
        // $inc by 0 stops Spring from adding its own +1, so a login never conflicts with an edit of the user.
        Update update = new Update().set(LAST_LOGIN_FIELD, lastLogin).inc(VERSION_FIELD, 0);
        mongoTemplate.updateFirst(query, update, AuthUser.class);
    }

    // A field-level write instead of read and save: it cannot hit a version conflict, and Spring still bumps the version.
    @Override
    public void updateImageUrl(String userId, String imageUrl) {
        Query query = new Query(Criteria.where(ID_FIELD).is(userId));
        Update update = new Update().set(IMAGE_URL_FIELD, imageUrl);
        mongoTemplate.updateFirst(query, update, AuthUser.class);
    }
}
