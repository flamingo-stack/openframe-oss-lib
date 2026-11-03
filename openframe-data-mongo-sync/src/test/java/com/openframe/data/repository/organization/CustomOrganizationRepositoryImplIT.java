package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.OrganizationIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Integration tests for {@link CustomOrganizationRepositoryImpl} against a real
 * MongoDB (Testcontainers). These exercise the last-activity range filter, the
 * compound {@code (updatedAt, _id)} keyset pagination (the behaviour that was
 * previously broken for anything other than the default {@code _id} sort), the
 * total count, and the retained legacy {@code _id} cursor path.
 */
@SpringBootTest(classes = OrganizationIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomOrganizationRepositoryImplIT extends BaseMongoIntegrationTest {

    private static final String SORT_UPDATED_AT = "updatedAt";
    private static final String SORT_ID = "_id";
    private static final String SORT_NAME = "name";
    private static final String SORT_ORGANIZATION_ID = "organizationId";
    private static final String SORT_CREATED_AT = "createdAt";
    private static final String DESC = "DESC";
    private static final String ASC = "ASC";
    private static final int MAX_WALK_PAGES = 10;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private OrganizationRepository repository;

    @BeforeEach
    void clean() {
        mongoTemplate.dropCollection(Organization.class);
    }

    private Organization save(String name, long updatedAtMillis) {
        return save(name, name, updatedAtMillis);
    }

    private Organization save(String name, String organizationId, long updatedAtMillis) {
        Organization org = Organization.builder()
                .name(name)
                .organizationId(organizationId)
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

    private static String nameCursor(Organization org) {
        return base64(org.getName()) + "_" + org.getId();
    }

    private static String organizationIdCursor(Organization org) {
        return base64(org.getOrganizationId()) + "_" + org.getId();
    }

    private static String createdAtCursor(Organization org) {
        return org.getCreatedAt().toEpochMilli() + "_" + org.getId();
    }

    private static String base64(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    /** Walk every page of the last-activity ordering, returning names in visiting order. */
    private List<String> walkByLastActivity(String direction, int pageSize) {
        return walkBy(SORT_UPDATED_AT, direction, pageSize, CustomOrganizationRepositoryImplIT::compoundCursor);
    }

    /** Walk every page of the given ordering with the given cursor encoding, returning names in visiting order. */
    private List<String> walkBy(String sortField, String direction, int pageSize, Function<Organization, String> cursorOf) {
        List<String> names = new ArrayList<>();
        String cursor = null;
        // A broken keyset repeats the same page forever; stop once the walk exceeds the saved rows.
        int remainingPages = MAX_WALK_PAGES;
        while (remainingPages-- > 0) {
            Query query = repository.buildOrganizationQuery(activeFilter(), null);
            List<Organization> page = repository.findOrganizationsWithCursor(
                    query, cursor, pageSize, sortField, direction);
            if (page.isEmpty()) {
                break;
            }
            page.forEach(o -> names.add(o.getName()));
            if (page.size() < pageSize) {
                break;
            }
            cursor = cursorOf.apply(page.get(page.size() - 1));
        }
        return names;
    }

    private void saveNamesOutOfOrder() {
        save("delta", "org-4", 100);
        save("alpha", "org-1", 200);
        save("echo", "org-5", 300);
        save("bravo", "org-2", 400);
        save("charlie", "org-3", 500);
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
    @DisplayName("excludeOrganizationIds keeps those organizations out of the page")
    void excludeOrganizationIdsFiltersThePage() {
        save("a", 100);
        save("b", 200);
        save("c", 300);

        OrganizationQueryFilter filter = OrganizationQueryFilter.builder()
                .status(OrganizationStatus.ACTIVE.name())
                .excludeOrganizationIds(Set.of("b"))
                .build();

        Query query = repository.buildOrganizationQuery(filter, null);
        List<Organization> result = repository.findOrganizationsWithCursor(query, null, 50, SORT_UPDATED_AT, DESC);

        assertThat(result).extracting(Organization::getName).containsExactly("c", "a");
    }

    @Test
    @DisplayName("countOrganizations honours excludeOrganizationIds, so filteredCount matches the page")
    void countHonoursExcludeOrganizationIds() {
        for (int i = 1; i <= 5; i++) {
            save("o" + i, i * 100L);
        }

        OrganizationQueryFilter filter = OrganizationQueryFilter.builder()
                .status(OrganizationStatus.ACTIVE.name())
                .excludeOrganizationIds(Set.of("o2", "o4"))
                .build();

        Query query = repository.buildOrganizationQuery(filter, null);

        assertThat(repository.countOrganizations(query)).isEqualTo(3L);
    }

    @Test
    @DisplayName("an empty excludeOrganizationIds set excludes nobody")
    void emptyExcludeOrganizationIdsKeepsEveryone() {
        save("a", 100);
        save("b", 200);

        OrganizationQueryFilter filter = OrganizationQueryFilter.builder()
                .status(OrganizationStatus.ACTIVE.name())
                .excludeOrganizationIds(Set.of())
                .build();

        Query query = repository.buildOrganizationQuery(filter, null);
        List<Organization> result = repository.findOrganizationsWithCursor(query, null, 50, SORT_UPDATED_AT, DESC);

        assertThat(result).extracting(Organization::getName).containsExactly("b", "a");
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

    @Test
    @DisplayName("name ASC cursor pagination returns every organization exactly once, in name order")
    void nameAscPaginationCoversAllPages() {
        saveNamesOutOfOrder();

        List<String> visited = walkBy(SORT_NAME, ASC, 2, CustomOrganizationRepositoryImplIT::nameCursor);

        assertThat(visited).containsExactly("alpha", "bravo", "charlie", "delta", "echo");
    }

    @Test
    @DisplayName("name DESC cursor pagination returns every organization exactly once, in reverse name order")
    void nameDescPaginationCoversAllPages() {
        saveNamesOutOfOrder();

        List<String> visited = walkBy(SORT_NAME, DESC, 2, CustomOrganizationRepositoryImplIT::nameCursor);

        assertThat(visited).containsExactly("echo", "delta", "charlie", "bravo", "alpha");
    }

    @Test
    @DisplayName("equal names page deterministically via the _id tie-breaker")
    void nameTieBreakerForEqualNames() {
        save("same", "org-1", 100);
        save("same", "org-2", 200);
        save("same", "org-3", 300);

        List<String> visited = walkBy(SORT_NAME, ASC, 1, CustomOrganizationRepositoryImplIT::nameCursor);

        assertThat(visited).containsExactly("same", "same", "same");
    }

    @Test
    @DisplayName("organizationId ASC cursor pagination returns every organization exactly once")
    void organizationIdAscPaginationCoversAllPages() {
        saveNamesOutOfOrder();

        List<String> visited = walkBy(SORT_ORGANIZATION_ID, ASC, 2,
                CustomOrganizationRepositoryImplIT::organizationIdCursor);

        assertThat(visited).containsExactly("alpha", "bravo", "charlie", "delta", "echo");
    }

    @Test
    @DisplayName("createdAt ASC cursor pagination returns every organization exactly once")
    void createdAtAscPaginationCoversAllPages() {
        saveNamesOutOfOrder();

        List<String> visited = walkBy(SORT_CREATED_AT, ASC, 2, CustomOrganizationRepositoryImplIT::createdAtCursor);

        assertThat(visited).containsExactly("delta", "alpha", "echo", "bravo", "charlie");
    }

    @Test
    @DisplayName("_id ASC cursor pagination moves upwards instead of repeating the first page")
    void idAscPaginationCoversAllPages() {
        saveNamesOutOfOrder();

        List<String> visited = walkBy(SORT_ID, ASC, 2, Organization::getId);

        assertThat(visited).containsExactly("delta", "alpha", "echo", "bravo", "charlie");
    }

    @Test
    @DisplayName("a bare _id cursor under a name sort resumes right after that row")
    void bareIdCursorUnderNameSortResumesAfterThatRow() {
        saveNamesOutOfOrder();

        Query firstQuery = repository.buildOrganizationQuery(activeFilter(), null);
        List<Organization> first = repository.findOrganizationsWithCursor(firstQuery, null, 2, SORT_NAME, ASC);
        Query secondQuery = repository.buildOrganizationQuery(activeFilter(), null);
        List<Organization> second = repository.findOrganizationsWithCursor(
                secondQuery, first.get(1).getId(), 2, SORT_NAME, ASC);

        assertThat(second).extracting(Organization::getName).containsExactly("charlie", "delta");
    }

    @Test
    @DisplayName("an unreadable cursor is refused instead of being served as page one")
    void unreadableCursorIsRefused() {
        save("a", 100);
        Query query = repository.buildOrganizationQuery(activeFilter(), null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> repository.findOrganizationsWithCursor(query, "not-a-cursor", 2, SORT_UPDATED_AT, DESC));

        assertThat(ex.getMessage()).contains("Invalid cursor");
    }
}
