package com.openframe.data.repository.user;

import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.InvitationStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import static org.springframework.util.StringUtils.hasText;

@RequiredArgsConstructor
@Slf4j
public class CustomInvitationRepositoryImpl implements CustomInvitationRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_EMAIL = "email";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_EXPIRES_AT = "expiresAt";
    private static final String FIELD_ROLES = "roles";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String REGEX_FLAG_CASE_INSENSITIVE = "i";

    private final MongoTemplate mongoTemplate;

    @Override
    public List<Invitation> findOpenInvitationsPage(InvitationListFilter filter, Instant now, String cursor,
                                                    int limit) {
        List<Criteria> criteria = listCriteria(filter, now);
        InvitationPageCursor.parse(cursor).map(CustomInvitationRepositoryImpl::after).ifPresent(criteria::add);
        Query query = new Query(new Criteria().andOperator(criteria))
                .with(Sort.by(Sort.Order.desc(FIELD_CREATED_AT), Sort.Order.desc(FIELD_ID)))
                .limit(limit);
        log.debug("Executing MongoDB invitation page query: {}", query);
        return mongoTemplate.find(query, Invitation.class);
    }

    @Override
    public long countOpenInvitations(InvitationListFilter filter, Instant now) {
        return mongoTemplate.count(new Query(new Criteria().andOperator(listCriteria(filter, now))),
                Invitation.class);
    }

    private static List<Criteria> listCriteria(InvitationListFilter filter, Instant now) {
        List<Criteria> criteria = new ArrayList<>();
        criteria.add(Criteria.where(FIELD_STATUS).is(InvitationStatus.PENDING));
        if (filter.expired() != null) {
            criteria.add(filter.expired()
                    ? Criteria.where(FIELD_EXPIRES_AT).lt(now)
                    : Criteria.where(FIELD_EXPIRES_AT).gte(now));
        }
        if (filter.roles() != null && !filter.roles().isEmpty()) {
            criteria.add(Criteria.where(FIELD_ROLES).in(filter.roles()));
        }
        if (hasText(filter.search())) {
            criteria.add(Criteria.where(FIELD_EMAIL)
                    .regex(Pattern.quote(filter.search().trim()), REGEX_FLAG_CASE_INSENSITIVE));
        }
        return criteria;
    }

    // Descending: a missing createdAt sorts after every value, so it is reachable from any position.
    private static Criteria after(InvitationPageCursor cursor) {
        Criteria sameCreatedAtPastId = new Criteria().andOperator(
                Criteria.where(FIELD_CREATED_AT).is(cursor.createdAt()),
                Criteria.where(FIELD_ID).lt(cursor.id()));
        if (cursor.createdAt() == null) {
            return sameCreatedAtPastId;
        }
        return new Criteria().orOperator(
                Criteria.where(FIELD_CREATED_AT).lt(cursor.createdAt()),
                sameCreatedAtPastId,
                Criteria.where(FIELD_CREATED_AT).is(null));
    }
}
