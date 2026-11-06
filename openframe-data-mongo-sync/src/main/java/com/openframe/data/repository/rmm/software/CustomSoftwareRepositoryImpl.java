package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.Software;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.regex.Pattern;

import static org.springframework.util.StringUtils.hasText;

@Repository
@RequiredArgsConstructor
public class CustomSoftwareRepositoryImpl implements CustomSoftwareRepository {

    private static final String SOURCE = "source";
    private static final String MATCH_STATE = "packageMatch.state";

    private final MongoTemplate mongoTemplate;

    // count takes the query's skip and limit into account, so it runs before the page is applied
    @Override
    public Page<Software> findTitles(SoftwareTitleQuery titles, Pageable pageable) {
        long total = mongoTemplate.count(Query.query(criteria(titles)), Software.class);
        List<Software> content = mongoTemplate.find(Query.query(criteria(titles)).with(pageable), Software.class);
        return new PageImpl<>(content, pageable, total);
    }

    private static Criteria criteria(SoftwareTitleQuery titles) {
        Criteria criteria = Criteria.where("tenantId").is(titles.tenantId()).and("devicesCount").gt(0);
        if (hasText(titles.nameLower())) {
            criteria.and("nameLower").regex(Pattern.quote(titles.nameLower()));
        }
        if (titles.vulnerableOnly()) {
            criteria.and("cveCount").gt(0);
        }
        Boolean manageable = titles.manageable();
        if (manageable == null) {
            return criteria;
        }
        return criteria.andOperator(manageable ? managed(titles) : unmanaged(titles));
    }

    private static Criteria managed(SoftwareTitleQuery titles) {
        return new Criteria().orOperator(
                Criteria.where(SOURCE).in(titles.managerSources()),
                Criteria.where(MATCH_STATE).is(PackageMatchState.MATCHED));
    }

    // $ne also takes a title the matcher never saw
    private static Criteria unmanaged(SoftwareTitleQuery titles) {
        return new Criteria().andOperator(
                Criteria.where(SOURCE).nin(titles.managerSources()),
                Criteria.where(MATCH_STATE).ne(PackageMatchState.MATCHED));
    }
}
