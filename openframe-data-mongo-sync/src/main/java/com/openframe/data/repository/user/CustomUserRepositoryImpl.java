package com.openframe.data.repository.user;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.filter.UserQueryFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.springframework.util.StringUtils.hasText;

@RequiredArgsConstructor
@Slf4j
public class CustomUserRepositoryImpl implements CustomUserRepository {

    private static final String FIELD_EMAIL = "email";
    private static final String FIELD_FIRST_NAME = "firstName";
    private static final String FIELD_LAST_NAME = "lastName";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String REGEX_FLAG_CASE_INSENSITIVE = "i";

    private final MongoTemplate mongoTemplate;

    @Override
    public List<User> findUsersBySearch(UserQueryFilter filter, int limit) {
        Query query = buildQuery(filter);
        query.limit(limit);
        query.with(Sort.by(Sort.Direction.DESC, FIELD_CREATED_AT));
        log.debug("Executing MongoDB user search query: {}", query);
        return mongoTemplate.find(query, User.class);
    }

    private Query buildQuery(UserQueryFilter filter) {
        Query query = new Query();
        if (filter == null) {
            return query;
        }
        if (filter.getStatus() != null) {
            query.addCriteria(Criteria.where(FIELD_STATUS).is(filter.getStatus()));
        }
        if (hasText(filter.getEmailRegex())) {
            query.addCriteria(Criteria.where(FIELD_EMAIL)
                    .regex(filter.getEmailRegex(), REGEX_FLAG_CASE_INSENSITIVE));
        }
        if (hasText(filter.getNameRegex())) {
            String pattern = filter.getNameRegex();
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where(FIELD_FIRST_NAME).regex(pattern, REGEX_FLAG_CASE_INSENSITIVE),
                    Criteria.where(FIELD_LAST_NAME).regex(pattern, REGEX_FLAG_CASE_INSENSITIVE)
            ));
        }
        return query;
    }
}
