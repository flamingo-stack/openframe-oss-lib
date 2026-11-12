package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import static org.springframework.util.StringUtils.hasText;

@Repository
@RequiredArgsConstructor
public class CustomSoftwareRepositoryImpl implements CustomSoftwareRepository {

    private static final String SOURCE = "source";
    private static final String MATCH_STATE = "packageMatch.state";
    private static final String TITLE_ID = "softwareTitleId";
    private static final String BREW_SOURCE = FleetSource.HOMEBREW_PACKAGES.getFleetName();

    private final MongoTemplate mongoTemplate;

    // count takes the query's skip and limit into account, so it runs before the page is applied
    @Override
    public Page<Software> findTitles(SoftwareTitleQuery titles, Pageable pageable) {
        Criteria criteria = criteria(titles);
        long total = mongoTemplate.count(Query.query(criteria), Software.class);
        Query page = Query.query(criteria).with(pageable);
        List<Software> content = mongoTemplate.find(page, Software.class);
        return new PageImpl<>(content, pageable, total);
    }

    private static Criteria criteria(SoftwareTitleQuery titles) {
        Criteria criteria = Criteria.where("tenantId").is(titles.getTenantId()).and("devicesCount").gt(0);
        if (hasText(titles.getNameLower())) {
            criteria.and("nameLower").regex(Pattern.quote(titles.getNameLower()));
        }
        if (titles.isVulnerableOnly()) {
            criteria.and("cveCount").gt(0);
        }
        List<Criteria> narrowed = new ArrayList<>();
        Boolean manageable = titles.getManageable();
        if (manageable != null) {
            Criteria byManager = manageable ? managed(titles) : unmanaged(titles);
            narrowed.add(byManager);
        }
        if (titles.getOsSources() != null) {
            Criteria bySystem = Criteria.where(SOURCE).in(titles.getOsSources());
            narrowed.add(bySystem);
        }
        if (titles.getInstallerSources() != null) {
            Criteria bySource = chosenSources(titles);
            narrowed.add(bySource);
        }
        if (titles.getAutoUpdateStatuses() != null) {
            Criteria byAutoUpdate = chosenAutoUpdate(titles);
            narrowed.add(byAutoUpdate);
        }
        return narrowed.isEmpty() ? criteria : criteria.andOperator(narrowed);
    }

    private static Criteria managed(SoftwareTitleQuery titles) {
        return new Criteria().orOperator(
                Criteria.where(SOURCE).in(titles.getManagerSources()),
                Criteria.where(MATCH_STATE).is(PackageMatchState.MATCHED));
    }

    // $ne also takes a title the matcher never saw
    private static Criteria unmanaged(SoftwareTitleQuery titles) {
        return new Criteria().andOperator(
                Criteria.where(SOURCE).nin(titles.getManagerSources()),
                Criteria.where(MATCH_STATE).ne(PackageMatchState.MATCHED));
    }

    private static Criteria chosenSources(SoftwareTitleQuery titles) {
        List<Criteria> chosen = new ArrayList<>();
        Criteria installed = Criteria.where(SOURCE).in(titles.getInstallerSources());
        chosen.add(installed);
        if (titles.isMatchedChosen()) {
            Criteria matched = Criteria.where(MATCH_STATE).is(PackageMatchState.MATCHED);
            chosen.add(matched);
        }
        if (titles.isUnmanagedChosen()) {
            Criteria unmanaged = unmanaged(titles);
            chosen.add(unmanaged);
        }
        return new Criteria().orOperator(chosen);
    }

    private static Criteria chosenAutoUpdate(SoftwareTitleQuery titles) {
        List<Criteria> chosen = titles.getAutoUpdateStatuses().stream()
                .map(status -> autoUpdate(status, titles))
                .toList();
        return new Criteria().orOperator(chosen);
    }

    // a brew title the brew catalog lacks shows NO_PACKAGE on its row and is OFF here: the read model does not store it
    private static Criteria autoUpdate(SoftwareAutoUpdateStatus status, SoftwareTitleQuery titles) {
        return switch (status) {
            case ON -> Criteria.where(TITLE_ID).in(titles.getEnabledPolicyTitleIds());
            case OFF -> new Criteria().orOperator(
                    Criteria.where(TITLE_ID).in(titles.getPolicyTitleIds()).nin(titles.getEnabledPolicyTitleIds()),
                    withoutPolicy(titles).orOperator(
                            Criteria.where(MATCH_STATE).is(PackageMatchState.MATCHED),
                            Criteria.where(SOURCE).is(BREW_SOURCE)));
            case NO_PACKAGE -> withoutPolicy(titles).and(MATCH_STATE).is(PackageMatchState.NO_PACKAGE);
            case NEEDS_ADOPTION -> Criteria.where(TITLE_ID).in(List.of());
        };
    }

    private static Criteria withoutPolicy(SoftwareTitleQuery titles) {
        return Criteria.where(TITLE_ID).nin(titles.getPolicyTitleIds());
    }
}
