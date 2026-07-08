package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.OrganizationIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link CustomOrganizationRepositoryImpl} against a real
 * MongoDB (Testcontainers). These exercise the last-activity range filter, the
 * compound {@code (updatedAt, _id)} keyset pagination (the behaviour that was
 * previously broken for anything other than the default {@code _id} sort), the
 * total count, and the retained legacy {@code _id} cursor path.
 */
@SpringBootTest(classes = OrganizationIntegrationTestApplication.class)
class CustomOrganizationRepositoryImplIT extends BaseMongoIntegrationTest {

    private static final String SORT_UPDATED_AT = "updatedAt";
    private static final String SORT_ID = "_id";
    private static final String DESC = "DESC";
    private static final String ASC = "ASC";

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private OrganizationRepository repository;

    @BeforeEach
    void clean() {
        mongoTemplate.dropCollection(Organization.class);
    }

    private Organization save(String name, long updatedAtMillis) {
        Organization org = Organization.builder()
                .name(name)
                .organizationId(name)
                .status(OrganizationStatus.ACTIVE)
                .createdAt(Instant.ofEpochMilli(updatedAtMillis))
                .updatedAt(Instant.ofEpochMilli(updatedAtMillis))
                .build();
        return mongoTemplate.save(org);
    }

    private static OrganizationQueryFilter activeFilter() {
        return OrganizationQueryFilter.builder().status(OrganizationStatus.ACTIVE.name()).build();
    }

    private static String compoundCursor(Organization org) {
        return org.getUpdatedAt().toEpochMilli() + "_" + org.getId();
    }

    /** Walk every page of the last-activity ordering, returning names in visiting order. */
    private List<String> walkByLastActivity(String direction, int pageSize) {
        List<String> names = new ArrayList<>();
        String cursor = null;
        while (true) {
            Query query = repository.buildOrganizationQuery(activeFilter(), null);
            List<Organization> page = repository.findOrganizationsWithCursor(
                    query, cursor, pageSize, SORT_UPDATED_AT, direction);
            if (page.isEmpty()) {
                break;
            }
            page.forEach(o -> names.add(o.getName()));
            if (page.size() < pageSize) {
                break;
            }
            cursor = compoundCursor(page.get(page.size() - 1));
        }
        return names;
    }

    @Test
    @DisplayName("last-activity range filters inclusively on both bounds")
    void lastActivityRangeInclusive() {
        save("a", 100);
        save("b", 200);
        save("c", 300);

        OrganizationQueryFilter filter = OrganizationQueryFilter.builder()
                .status(OrganizationStatus.ACTIVE.name())
                .lastActivityFrom(Instant.ofEpochMilli(200))
                .lastActivityTo(Instant.ofEpochMilli(300))
                .build();

        Query query = repository.buildOrganizationQuery(filter, null);
        List<Organization> result = repository.findOrganizationsWithCursor(query, null, 50, SORT_UPDATED_AT, DESC);

        assertThat(result).extracting(Organization::getName).containsExactly("c", "b");
    }

    @Test
    @DisplayName("last-activity 'from' bound works independently")
    void lastActivityFromOnly() {
        save("a", 100);
        save("b", 200);
        save("c", 300);

        OrganizationQueryFilter filter = OrganizationQueryFilter.builder()
                .status(OrganizationStatus.ACTIVE.name())
                .lastActivityFrom(Instant.ofEpochMilli(200))
                .build();

        Query query = repository.buildOrganizationQuery(filter, null);
        List<Organization> result = repository.findOrganizationsWithCursor(query, null, 50, SORT_UPDATED_AT, DESC);

        assertThat(result).extracting(Organization::getName).containsExactly("c", "b");
    }

    @Test
    @DisplayName("last-activity 'to' bound works independently")
    void lastActivityToOnly() {
        save("a", 100);
        save("b", 200);
        save("c", 300);

        OrganizationQueryFilter filter = OrganizationQueryFilter.builder()
                .status(OrganizationStatus.ACTIVE.name())
                .lastActivityTo(Instant.ofEpochMilli(200))
                .build();

        Query query = repository.buildOrganizationQuery(filter, null);
        List<Organization> result = repository.findOrganizationsWithCursor(query, null, 50, SORT_UPDATED_AT, DESC);

        assertThat(result).extracting(Organization::getName).containsExactly("b", "a");
    }

    @Test
    @DisplayName("DESC cursor pagination is correct and complete across every page")
    void descPaginationCoversAllPages() {
        for (int i = 1; i <= 5; i++) {
            save("o" + i, i * 100L);
        }

        List<String> visited = walkByLastActivity(DESC, 2);

        assertThat(visited).containsExactly("o5", "o4", "o3", "o2", "o1");
    }

    @Test
    @DisplayName("ASC cursor pagination is correct and complete across every page")
    void ascPaginationCoversAllPages() {
        for (int i = 1; i <= 5; i++) {
            save("o" + i, i * 100L);
        }

        List<String> visited = walkByLastActivity(ASC, 2);

        assertThat(visited).containsExactly("o1", "o2", "o3", "o4", "o5");
    }

    @Test
    @DisplayName("equal last-activity values page deterministically via the _id tie-breaker")
    void tieBreakerForEqualLastActivity() {
        save("a", 500);
        save("b", 500);
        save("c", 500);

        List<String> visited = walkByLastActivity(DESC, 1);

        assertThat(visited).hasSize(3).doesNotHaveDuplicates()
                .containsExactlyInAnyOrder("a", "b", "c");
    }

    @Test
    @DisplayName("countOrganizations returns the full filtered total, ignoring pagination")
    void countReturnsFilteredTotal() {
        for (int i = 1; i <= 7; i++) {
            save("o" + i, i * 100L);
        }

        Query query = repository.buildOrganizationQuery(activeFilter(), null);

        assertThat(repository.countOrganizations(query)).isEqualTo(7L);
    }

    @Test
    @DisplayName("legacy _id cursor still paginates without overlap")
    void legacyIdCursorPaginates() {
        for (int i = 1; i <= 3; i++) {
            save("o" + i, i * 100L);
        }

        Query firstQuery = repository.buildOrganizationQuery(activeFilter(), null);
        List<Organization> first = repository.findOrganizationsWithCursor(firstQuery, null, 2, SORT_ID, DESC);
        assertThat(first).hasSize(2);

        Query secondQuery = repository.buildOrganizationQuery(activeFilter(), null);
        List<Organization> second = repository.findOrganizationsWithCursor(
                secondQuery, first.get(first.size() - 1).getId(), 2, SORT_ID, DESC);

        assertThat(second).extracting(Organization::getId)
                .doesNotContainAnyElementsOf(first.stream().map(Organization::getId).toList());
    }
}
