package com.openframe.data.repository.rmm.osupdate;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomOsUpdateRepositoryImplTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String OS_UPDATE_ID = "6aff19c07ce86a3f0386ff82";
    private static final Instant FIRST_SEEN_AT = Instant.parse("2026-11-20T09:14:02Z");
    private static final String CURSOR = FIRST_SEEN_AT.toEpochMilli() + "|" + OS_UPDATE_ID;

    @Mock private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;

    @InjectMocks private CustomOsUpdateRepositoryImpl repository;

    private OsUpdate osUpdate;

    @BeforeEach
    void setUp() {
        osUpdate = OsUpdate.builder()
                .id(OS_UPDATE_ID)
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier("a1b2c3d4-0000-4444-8888-99aabbccddee:201")
                .firstSeenAt(FIRST_SEEN_AT)
                .build();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void findPage_noFilterAndNoCursor_firstPageOfTheTenantLatestSeenFirst(String cursor) {
        // setup
        List<OsUpdate> stored = List.of(osUpdate);
        when(mongoTemplate.find(queryCaptor.capture(), eq(OsUpdate.class))).thenReturn(stored);
        Document expectedFilter = new Document("$and", List.of(new Document("tenantId", TENANT_ID)));

        // execution
        List<OsUpdate> page = repository.findPage(TENANT_ID, OsUpdateFilter.NONE, cursor, 21);

        // verifications
        assertThat(page).containsExactly(osUpdate);
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(expectedFilter);
        assertThat(queryCaptor.getValue().getSortObject().toJson()).isEqualTo(latestSeenFirst().toJson());
        assertThat(queryCaptor.getValue().getLimit()).isEqualTo(21);
    }

    @Test
    void findPage_platformAndClassifications_bothNarrowThePage() {
        // setup
        OsUpdateFilter filter = OsUpdateFilter.builder()
                .platform(OsPlatform.WINDOWS)
                .classifications(List.of(OsUpdateClassification.SECURITY, OsUpdateClassification.DRIVER))
                .build();
        when(mongoTemplate.find(queryCaptor.capture(), eq(OsUpdate.class))).thenReturn(List.of());
        Document ofClassifications = new Document("classification",
                new Document("$in", List.of(OsUpdateClassification.SECURITY, OsUpdateClassification.DRIVER)));
        Document expectedFilter = new Document("$and", List.of(
                new Document("tenantId", TENANT_ID), new Document("platform", OsPlatform.WINDOWS), ofClassifications));

        // execution
        repository.findPage(TENANT_ID, filter, null, 5);

        // verifications
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(expectedFilter);
    }

    @Test
    void findPage_emptyClassificationsAndBlankSearch_neitherNarrowsThePage() {
        // setup
        OsUpdateFilter filter = OsUpdateFilter.builder().classifications(List.of()).search(" ").build();
        when(mongoTemplate.find(queryCaptor.capture(), eq(OsUpdate.class))).thenReturn(List.of());
        Document expectedFilter = new Document("$and", List.of(new Document("tenantId", TENANT_ID)));

        // execution
        repository.findPage(TENANT_ID, filter, null, 5);

        // verifications
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(expectedFilter);
    }

    @Test
    void findPage_search_matchesTheTypedTextInNameKbIdsAndCveIdsIgnoringCase() {
        // setup
        OsUpdateFilter filter = OsUpdateFilter.builder().search(" KB5051987 (x64).* ").build();
        when(mongoTemplate.find(queryCaptor.capture(), eq(OsUpdate.class))).thenReturn(List.of());

        // execution
        repository.findPage(TENANT_ID, filter, null, 5);

        // verifications
        List<Document> conditions = queryCaptor.getValue().getQueryObject().getList("$and", Document.class);
        List<Document> searchedFields = conditions.getLast().getList("$or", Document.class);
        assertThat(searchedFields)
                .extracting(searchedField -> searchedField.keySet().iterator().next())
                .containsExactly("displayName", "kbArticleIds", "cveIds");
        assertThat(searchedFields)
                .extracting(searchedField -> searchedField.values().iterator().next())
                .allSatisfy(searched -> assertThat((Pattern) searched)
                        .returns("\\QKB5051987 (x64).*\\E", Pattern::pattern)
                        .returns(Pattern.CASE_INSENSITIVE, Pattern::flags));
    }

    @Test
    void findPage_cursorOfAnUpdate_readsStrictlyAfterItByFirstSeenThenId() {
        // setup
        when(mongoTemplate.find(queryCaptor.capture(), eq(OsUpdate.class))).thenReturn(List.of());
        Document seenEarlier = new Document("firstSeenAt", new Document("$lt", FIRST_SEEN_AT));
        Document seenTogetherOlderId = new Document("firstSeenAt", FIRST_SEEN_AT)
                .append("_id", new Document("$lt", new ObjectId(OS_UPDATE_ID)));
        Document keyset = new Document("$or", List.of(seenEarlier, seenTogetherOlderId));
        Document expectedFilter = new Document("$and", List.of(new Document("tenantId", TENANT_ID), keyset));

        // execution
        repository.findPage(TENANT_ID, OsUpdateFilter.NONE, CURSOR, 5);

        // verifications
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(expectedFilter);
        assertThat(queryCaptor.getValue().getSortObject().toJson()).isEqualTo(latestSeenFirst().toJson());
    }

    @ParameterizedTest
    @CsvSource({
            "1795142470000,                          no separator",
            "yesterday|6aff19c07ce86a3f0386ff82,     Unparseable epoch millis",
            "1795142470000|not-an-object-id,         Invalid ObjectId"
    })
    void findPage_cursorOfAnotherShape_throwsBadRequest(String cursor, String expectedMessage) {
        // setup

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> repository.findPage(TENANT_ID, OsUpdateFilter.NONE, cursor, 5));

        // verifications
        assertThat(ex.getMessage()).contains(expectedMessage);
    }

    @Test
    void encodeCursor_update_firstSeenMillisThenId() {
        // setup

        // execution
        String cursor = repository.encodeCursor(osUpdate);

        // verifications
        assertThat(cursor).isEqualTo(CURSOR);
    }

    private static Document latestSeenFirst() {
        return new Document("firstSeenAt", -1).append("_id", -1);
    }
}
