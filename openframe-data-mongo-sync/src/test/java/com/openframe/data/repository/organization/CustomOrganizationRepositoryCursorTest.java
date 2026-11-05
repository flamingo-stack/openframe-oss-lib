package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomOrganizationRepositoryCursorTest {

    private static final String ID_FIELD = "_id";
    private static final String NAME_FIELD = "name";
    private static final String ORGANIZATION_ID_FIELD = "organizationId";
    private static final String CREATED_AT_FIELD = "createdAt";
    private static final String UPDATED_AT_FIELD = "updatedAt";
    private static final String ASC = "ASC";
    private static final String DESC = "DESC";
    private static final String OR = "$or";
    private static final String AND = "$and";
    private static final ObjectId CURSOR_ID = new ObjectId("665f1c2ab3e4d5f6a7b8c9e1");
    private static final String CURSOR_HEX = CURSOR_ID.toHexString();
    private static final String NAME_WITH_SEPARATOR = "Acme_Corp";

    @Mock
    private MongoTemplate mongoTemplate;

    @Captor
    private ArgumentCaptor<Query> queryCaptor;

    @InjectMocks
    private CustomOrganizationRepositoryImpl repository;

    @Test
    void findOrganizationsWithCursor_idSortAscending_keysetMovesUpwardsFromCursor() {
        // setup
        stubEmptyFind();

        // execution
        repository.findOrganizationsWithCursor(new Query(), CURSOR_HEX, 3, ID_FIELD, ASC);

        // verifications
        Query executed = executedQuery();
        assertThat(executed.getQueryObject().get(ID_FIELD, Document.class)).containsEntry("$gt", CURSOR_ID);
        assertThat(executed.getSortObject()).containsEntry(ID_FIELD, 1);
    }

    @Test
    void findOrganizationsWithCursor_idSortDescending_keysetMovesDownwardsFromCursor() {
        // setup
        stubEmptyFind();

        // execution
        repository.findOrganizationsWithCursor(new Query(), CURSOR_HEX, 3, ID_FIELD, DESC);

        // verifications
        Query executed = executedQuery();
        assertThat(executed.getQueryObject().get(ID_FIELD, Document.class)).containsEntry("$lt", CURSOR_ID);
        assertThat(executed.getSortObject()).containsEntry(ID_FIELD, -1);
    }

    @Test
    void findOrganizationsWithCursor_nameSortAscending_compoundKeysetOnNameThenId() {
        // setup
        stubEmptyFind();
        String cursor = base64(NAME_WITH_SEPARATOR) + "_" + CURSOR_HEX;

        // execution
        repository.findOrganizationsWithCursor(new Query(), cursor, 3, NAME_FIELD, ASC);

        // verifications
        Query executed = executedQuery();
        List<Document> keyset = executed.getQueryObject().getList(OR, Document.class);
        assertThat(keyset).hasSize(2);
        assertThat(keyset.getFirst().get(NAME_FIELD, Document.class)).containsEntry("$gt", NAME_WITH_SEPARATOR);
        List<Document> tieBreak = keyset.getLast().getList(AND, Document.class);
        assertThat(tieBreak.getFirst()).containsEntry(NAME_FIELD, NAME_WITH_SEPARATOR);
        assertThat(tieBreak.getLast().get(ID_FIELD, Document.class)).containsEntry("$gt", CURSOR_ID);
        assertThat(executed.getSortObject())
                .containsEntry(NAME_FIELD, 1)
                .containsEntry(ID_FIELD, 1);
    }

    @Test
    void findOrganizationsWithCursor_nameSortDescending_compoundKeysetUsesLessThan() {
        // setup
        stubEmptyFind();
        String cursor = base64(NAME_WITH_SEPARATOR) + "_" + CURSOR_HEX;

        // execution
        repository.findOrganizationsWithCursor(new Query(), cursor, 3, NAME_FIELD, DESC);

        // verifications
        Query executed = executedQuery();
        List<Document> keyset = executed.getQueryObject().getList(OR, Document.class);
        assertThat(keyset.getFirst().get(NAME_FIELD, Document.class)).containsEntry("$lt", NAME_WITH_SEPARATOR);
        List<Document> tieBreak = keyset.getLast().getList(AND, Document.class);
        assertThat(tieBreak.getLast().get(ID_FIELD, Document.class)).containsEntry("$lt", CURSOR_ID);
        assertThat(executed.getSortObject())
                .containsEntry(NAME_FIELD, -1)
                .containsEntry(ID_FIELD, -1);
    }

    @Test
    void findOrganizationsWithCursor_organizationIdSortAscending_compoundKeysetOnOrganizationId() {
        // setup
        stubEmptyFind();
        String cursor = base64("org_7") + "_" + CURSOR_HEX;

        // execution
        repository.findOrganizationsWithCursor(new Query(), cursor, 3, ORGANIZATION_ID_FIELD, ASC);

        // verifications
        List<Document> keyset = executedQuery().getQueryObject().getList(OR, Document.class);
        assertThat(keyset.getFirst().get(ORGANIZATION_ID_FIELD, Document.class)).containsEntry("$gt", "org_7");
    }

    @Test
    void findOrganizationsWithCursor_createdAtSortDescending_compoundKeysetOnCreatedAtMillis() {
        // setup
        stubEmptyFind();
        String cursor = "4200_" + CURSOR_HEX;

        // execution
        repository.findOrganizationsWithCursor(new Query(), cursor, 3, CREATED_AT_FIELD, DESC);

        // verifications
        List<Document> keyset = executedQuery().getQueryObject().getList(OR, Document.class);
        assertThat(keyset.getFirst().get(CREATED_AT_FIELD, Document.class))
                .containsEntry("$lt", Instant.ofEpochMilli(4200));
        List<Document> tieBreak = keyset.getLast().getList(AND, Document.class);
        assertThat(tieBreak.getLast().get(ID_FIELD, Document.class)).containsEntry("$lt", CURSOR_ID);
    }

    @Test
    void findOrganizationsWithCursor_updatedAtSortWithMillisCursor_keepsExistingCursorFormat() {
        // setup
        stubEmptyFind();
        String cursor = "500_" + CURSOR_HEX;

        // execution
        repository.findOrganizationsWithCursor(new Query(), cursor, 3, UPDATED_AT_FIELD, ASC);

        // verifications
        List<Document> keyset = executedQuery().getQueryObject().getList(OR, Document.class);
        assertThat(keyset.getFirst().get(UPDATED_AT_FIELD, Document.class))
                .containsEntry("$gt", Instant.ofEpochMilli(500));
    }

    @Test
    void findOrganizationsWithCursor_nameSortWithBareIdCursor_resolvesSortValueFromCursorRow() {
        // setup
        stubEmptyFind();
        Organization anchor = Organization.builder().id(CURSOR_HEX).name("Acme").build();
        when(mongoTemplate.findById(CURSOR_HEX, Organization.class)).thenReturn(anchor);

        // execution
        repository.findOrganizationsWithCursor(new Query(), CURSOR_HEX, 3, NAME_FIELD, ASC);

        // verifications
        List<Document> keyset = executedQuery().getQueryObject().getList(OR, Document.class);
        assertThat(keyset.getFirst().get(NAME_FIELD, Document.class)).containsEntry("$gt", "Acme");
        List<Document> tieBreak = keyset.getLast().getList(AND, Document.class);
        assertThat(tieBreak.getLast().get(ID_FIELD, Document.class)).containsEntry("$gt", CURSOR_ID);
    }

    @Test
    void findOrganizationsWithCursor_nameSortWithBareIdOfMissingRow_throwsIllegalArgument() {
        // setup
        when(mongoTemplate.findById(CURSOR_HEX, Organization.class)).thenReturn(null);
        Query query = new Query();

        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> repository.findOrganizationsWithCursor(query, CURSOR_HEX, 3, NAME_FIELD, ASC));

        // verifications
        assertThat(ex.getMessage()).contains("Invalid cursor");
        verify(mongoTemplate, never()).find(any(Query.class), eq(Organization.class));
    }

    @ParameterizedTest
    @MethodSource("unparsableCursors")
    void findOrganizationsWithCursor_unparsableCursor_throwsIllegalArgument(String cursor, String sortField) {
        // setup
        Query query = new Query();

        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> repository.findOrganizationsWithCursor(query, cursor, 3, sortField, DESC));

        // verifications
        assertThat(ex.getMessage()).contains("Invalid cursor");
        verify(mongoTemplate, never()).find(any(Query.class), eq(Organization.class));
    }

    private static Stream<Arguments> unparsableCursors() {
        return Stream.of(
                Arguments.of("not-a-cursor", ID_FIELD),
                Arguments.of("not-a-cursor", UPDATED_AT_FIELD),
                Arguments.of("not-a-cursor", NAME_FIELD),
                Arguments.of("500_not-an-object-id", UPDATED_AT_FIELD),
                Arguments.of("not-millis_" + CURSOR_HEX, UPDATED_AT_FIELD),
                Arguments.of("not-millis_" + CURSOR_HEX, CREATED_AT_FIELD),
                Arguments.of("***_" + CURSOR_HEX, NAME_FIELD)
        );
    }

    private void stubEmptyFind() {
        when(mongoTemplate.find(any(Query.class), eq(Organization.class))).thenReturn(List.of());
    }

    private Query executedQuery() {
        verify(mongoTemplate).find(queryCaptor.capture(), eq(Organization.class));
        return queryCaptor.getValue();
    }

    private static String base64(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
