package com.openframe.data.repository.user;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.document.user.filter.UserQueryFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

import static org.springframework.util.StringUtils.hasText;

@RequiredArgsConstructor
@Slf4j
public class CustomUserRepositoryImpl implements CustomUserRepository {

    private static final String FIELD_ID = "_id";
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

    @Override
    public List<User> findUsersPage(Collection<UserStatus> statuses, String search, String cursor, int limit) {
        List<Criteria> criteria = listCriteria(statuses, search);
        UserPageCursor.parse(cursor).ifPresent(after -> criteria.add(new Criteria().orOperator(
                Criteria.where(FIELD_EMAIL).gt(after.email()),
                new Criteria().andOperator(
                        Criteria.where(FIELD_EMAIL).is(after.email()),
                        Criteria.where(FIELD_ID).gt(after.id())))));
        Query query = toQuery(criteria)
                .with(Sort.by(Sort.Order.asc(FIELD_EMAIL), Sort.Order.asc(FIELD_ID)))
                .limit(limit);
        log.debug("Executing MongoDB user page query: {}", query);
        return mongoTemplate.find(query, User.class);
    }

    @Override
    public long countUsers(Collection<UserStatus> statuses, String search) {
        return mongoTemplate.count(toQuery(listCriteria(statuses, search)), User.class);
    }

    private List<Criteria> listCriteria(Collection<UserStatus> statuses, String search) {
        List<Criteria> criteria = new ArrayList<>();
        if (statuses != null && !statuses.isEmpty()) {
            criteria.add(Criteria.where(FIELD_STATUS).in(statuses));
        }
        if (hasText(search)) {
            for (String token : search.trim().split("\\s+")) {
                String pattern = Pattern.quote(token);
                criteria.add(new Criteria().orOperator(
                        Criteria.where(FIELD_FIRST_NAME).regex(pattern, REGEX_FLAG_CASE_INSENSITIVE),
                        Criteria.where(FIELD_LAST_NAME).regex(pattern, REGEX_FLAG_CASE_INSENSITIVE),
                        new Criteria().andOperator(
                                Criteria.where(FIELD_EMAIL).regex(pattern, REGEX_FLAG_CASE_INSENSITIVE),
                                Criteria.where(FIELD_STATUS).ne(UserStatus.SELF_DELETED))));
            }
        }
        return criteria;
    }

    // One keyless $and: the tenant template adds its own keyed tenantId criteria next to it.
    private static Query toQuery(List<Criteria> criteria) {
        return criteria.isEmpty() ? new Query() : new Query(new Criteria().andOperator(criteria));
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
                    .regex(Pattern.quote(filter.getEmailRegex()), REGEX_FLAG_CASE_INSENSITIVE));
        }
        if (hasText(filter.getNameRegex())) {
            String pattern = Pattern.quote(filter.getNameRegex());
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where(FIELD_FIRST_NAME).regex(pattern, REGEX_FLAG_CASE_INSENSITIVE),
                    Criteria.where(FIELD_LAST_NAME).regex(pattern, REGEX_FLAG_CASE_INSENSITIVE)
            ));
        }
        return query;
    }
}
