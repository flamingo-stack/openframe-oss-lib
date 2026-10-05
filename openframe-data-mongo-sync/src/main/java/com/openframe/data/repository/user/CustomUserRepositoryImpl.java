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
import java.util.regex.Pattern;

import static org.springframework.util.StringUtils.hasText;

@RequiredArgsConstructor
@Slf4j
public class CustomUserRepositoryImpl implements CustomUserRepository {

    private static final String FIELD_EMAIL = "email";
    private static final String FIELD_FIRST_NAME = "firstName";
    private static final String FIELD_LAST_NAME = "lastName";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_ID = "id";
    private static final String REGEX_FLAG_CASE_INSENSITIVE = "i";

    // Shared by both reads, so a cursor taken from one page lands in the same order on the next. The
    // row id is there to break ties: createdAt alone is not unique.
    private static final Sort PAGE_SORT =
            Sort.by(Sort.Order.desc(FIELD_CREATED_AT), Sort.Order.desc(FIELD_ID));

    private final MongoTemplate mongoTemplate;

    @Override
    public List<User> findUsersBySearch(UserQueryFilter filter, int limit) {
        Query query = pageQuery(buildQuery(filter), limit);
        log.debug("Executing MongoDB user search query: {}", query);
        return mongoTemplate.find(query, User.class);
    }

    @Override
    public List<User> findUserPageAfter(UserQueryFilter filter, UserSortKey after, int limit) {
        Query query = pageQuery(buildQuery(filter).addCriteria(afterCriteria(after)), limit);
        log.debug("Executing MongoDB user search query after {}: {}", after.id(), query);
        return mongoTemplate.find(query, User.class);
    }

    private static Query pageQuery(Query query, int limit) {
        return query.with(PAGE_SORT).limit(limit);
    }

    private static Criteria afterCriteria(UserSortKey after) {
        if (after.createdAt() == null) {
            // Already among the rows that carry no creation date, so only the id moves on.
            return new Criteria().andOperator(
                    Criteria.where(FIELD_CREATED_AT).is(null),
                    Criteria.where(FIELD_ID).lt(after.id()));
        }
        // A range query never matches a missing createdAt, so those rows are named on their own.
        // They sort last, so they are reached only once the dated rows run out.
        return new Criteria().orOperator(
                Criteria.where(FIELD_CREATED_AT).lt(after.createdAt()),
                new Criteria().andOperator(
                        Criteria.where(FIELD_CREATED_AT).is(after.createdAt()),
                        Criteria.where(FIELD_ID).lt(after.id())),
                Criteria.where(FIELD_CREATED_AT).is(null));
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
