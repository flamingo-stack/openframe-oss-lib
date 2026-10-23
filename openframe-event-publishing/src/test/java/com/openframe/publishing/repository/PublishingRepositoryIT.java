package com.openframe.publishing.repository;

import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.fixture.Widgets.Widget;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.fixture.Widgets;
import com.openframe.publishing.persistence.OutboxEvent;
import com.openframe.publishing.persistence.OutboxIndexInitializer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.data.repository.CrudRepository;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;

// Real repository proxies with the publishing interceptor, in real Mongo transactions: each write commits or rolls back with its rows.
@SpringBootTest(classes = PublishingRepositoryIT.TestApplication.class,
        properties = {"openframe.events.topics.organizations.enabled=true", "spring.data.mongodb.enabled=true",
                "openframe.events.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class PublishingRepositoryIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    @Autowired private WidgetRepository widgetRepository;
    @Autowired private CascadeLikeAspect cascadeLikeAspect;
    @Autowired private MongoTemplate mongoTemplate;
    @MockitoSpyBean private PublishedAggregateTopics publishedAggregateTopics;
    @Autowired private OutboxIndexInitializer outboxIndexInitializer;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Widget.class);
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(Widget.class);
        mongoTemplate.createCollection(OutboxEvent.class);
    }

    @Test
    void save_commitsTheDocumentAndOneOutboxRowTogether() {
        Widget saved = widgetRepository.save(widget("Printer"));

        assertThat(outboxRows()).singleElement().satisfies(row -> {
            assertThat(row.getAggregateType()).isEqualTo("organizations");
            assertThat(row.getAggregateId()).isEqualTo(saved.getId());
            assertThat(row.getTenantId()).isEqualTo("tenant-1");
            assertThat(row.getPayload()).containsEntry("tenantId", "tenant-1").containsEntry("deleted", false);
            assertThat(versionOf(row)).isEqualTo(saved.getVersion());
            assertThat(eventOf(row)).containsEntry("name", "Printer");
        });
    }

    @Test
    void startup_createsTheTtlIndexOnTheOutbox() {
        outboxIndexInitializer.start();

        List<IndexInfo> indexes = mongoTemplate.indexOps(OutboxEvent.class).getIndexInfo();

        assertThat(indexes).anySatisfy(index -> {
            assertThat(index.getName()).isEqualTo("outbox_occurredAt_ttl");
            assertThat(index.getExpireAfter()).contains(Duration.ofDays(7));
        });
    }

    @Test
    void anAspectAroundTheRepository_runsOutsideTheOutboxTransaction_soItsFailureDoesNotAbortTheSave() {
        mongoTemplate.dropCollection(CascadeLikeAspect.CASCADE_COLLECTION);

        Widget saved = widgetRepository.save(widget(CascadeLikeAspect.CASCADING_NAME));

        assertThat(cascadeLikeAspect.ranInTransaction()).isFalse();
        assertThat(widgetRepository.findById(saved.getId())).isPresent();
        assertThat(outboxCount()).isEqualTo(1);
    }

    @Test
    void aStaleSave_failsWithAVersionConflict_andWritesNoRow() {
        Widget saved = widgetRepository.save(widget("Printer"));
        Widget first = widgetRepository.findById(saved.getId()).orElseThrow();
        Widget stale = widgetRepository.findById(saved.getId()).orElseThrow();
        first.setName("Scanner");
        widgetRepository.save(first);
        stale.setName("Router");

        assertThatThrownBy(() -> widgetRepository.save(stale)).isInstanceOf(OptimisticLockingFailureException.class);

        assertThat(outboxCount()).isEqualTo(2);
        assertThat(widgetRepository.findById(saved.getId())).get().extracting(Widget::getName).isEqualTo("Scanner");
    }

    @Test
    void aFailureAfterTheWrite_rollsBackTheDocumentToo() {
        Widget failing = new Widget("w-1", "tenant-1", Widgets.FAILING_NAME, null, null);

        assertThatThrownBy(() -> widgetRepository.save(failing)).isInstanceOf(IllegalStateException.class);

        assertThat(widgetRepository.findById("w-1")).isEmpty();
        assertThat(outboxCount()).isZero();
    }

    @Test
    void anUpdateBySave_writesARowWithTheNewVersion() {
        Widget saved = widgetRepository.save(widget("Printer"));
        saved.setName("Scanner");

        widgetRepository.save(saved);

        assertThat(versionOf(rowNamed("Scanner"))).isEqualTo(1L);
    }

    @Test
    void aCallerHoldingTheRepositoryAsCrudRepository_stillPublishes() {
        CrudRepository<Widget, String> crudRepository = widgetRepository;

        crudRepository.save(widget("Printer"));

        assertThat(outboxCount()).isEqualTo(1);
    }

    @Test
    void saveAllAndInsert_writeOneRowPerDocument() {
        widgetRepository.saveAll(List.of(widget("Printer"), widget("Scanner")));
        widgetRepository.insert(widget("Router"));

        assertThat(outboxCount()).isEqualTo(3);
    }

    @Test
    void everyBaseDelete_writesADeleteEnvelopeThenATombstone_newerThanTheStoredVersion() {
        Widget byId = widgetRepository.save(widget("Printer"));
        Widget byEntity = widgetRepository.save(widget("Scanner"));
        Widget byIds = widgetRepository.save(widget("Router"));
        Widget byEntities = widgetRepository.save(widget("Modem"));

        widgetRepository.deleteById(byId.getId());
        widgetRepository.delete(byEntity);
        widgetRepository.deleteAllById(List.of(byIds.getId()));
        widgetRepository.deleteAll(List.of(byEntities));

        assertThat(deletedRows()).hasSize(4).allSatisfy(row -> {
            assertThat(versionOf(row)).isEqualTo(1L);
            assertThat(row.getTenantId()).isEqualTo("tenant-1");
            assertThat(row.getPayload()).containsEntry("deleted", true).containsEntry("event", null);
        });
        assertThat(tombstoneRows()).hasSize(4).allSatisfy(row -> assertThat(row.getTenantId()).isEqualTo("tenant-1"));
        assertThat(widgetRepository.count()).isZero();
    }

    @Test
    void aDeleteOfAHandBuiltEntityWithoutATenant_takesTheTenantFromTheDatabase() {
        Widget saved = widgetRepository.save(widget("Printer"));
        saved.setName("Scanner");
        Widget renamed = widgetRepository.save(saved);
        long deleteVersion = renamed.getVersion() + 1;
        // Spring Data deletes by id and version, so only the tenant can be missing from an entity it accepts.
        Widget handBuilt = new Widget(renamed.getId(), null, null, null, renamed.getVersion());

        widgetRepository.delete(handBuilt);

        assertThat(deletedRows()).singleElement().satisfies(row -> {
            assertThat(row.getTenantId()).isEqualTo("tenant-1");
            assertThat(row.getPayload()).containsEntry("tenantId", "tenant-1");
            assertThat(versionOf(row)).isEqualTo(deleteVersion);
        });
    }

    @Test
    void aDelete_writesItsEnvelopeBeforeItsTombstone() {
        Widget saved = widgetRepository.save(widget("Printer"));

        widgetRepository.deleteById(saved.getId());

        Query inInsertOrder = new Query().with(Sort.by(Sort.Direction.ASC, "_id"));
        List<OutboxEvent> rows = mongoTemplate.find(inInsertOrder, OutboxEvent.class);
        assertThat(rows).hasSize(3);
        assertThat(rows.get(1).getPayload()).containsEntry("deleted", true);
        assertThat(rows.get(2).getPayload()).isNull();
    }

    @Test
    void deleteAll_deletesEveryDocument_andWritesBothDeleteRowsForEach() {
        widgetRepository.saveAll(List.of(widget("Printer"), widget("Scanner")));

        widgetRepository.deleteAll();

        assertThat(widgetRepository.count()).isZero();
        assertThat(deletedRows()).hasSize(2).allSatisfy(row -> assertThat(versionOf(row)).isEqualTo(1L));
        assertThat(tombstoneRows()).hasSize(2);
    }

    @Test
    void deleteAll_withPublishOff_stillDeletes() {
        doReturn(false).when(publishedAggregateTopics).isPublishing("organizations");
        widgetRepository.saveAll(List.of(widget("Printer"), widget("Scanner")));

        widgetRepository.deleteAll();

        assertThat(widgetRepository.count()).isZero();
        assertThat(outboxCount()).isZero();
    }

    @Test
    void aDerivedDeleteReturningTheDocuments_writesADeletedRowForEach() {
        widgetRepository.saveAll(List.of(widget("Printer"), widget("Printer")));

        List<Widget> deleted = widgetRepository.deleteByName("Printer");

        assertThat(deleted).hasSize(2);
        assertThat(deletedRows()).hasSize(2);
    }

    @Test
    void theTombstoneRow_storesThePayloadKey_asNull_forDebeziumsRouter() {
        Widget saved = widgetRepository.save(widget("Printer"));

        widgetRepository.delete(saved);

        List<org.bson.Document> rawRows = mongoTemplate.getCollection("event_outbox").find().into(new ArrayList<>());
        List<org.bson.Document> rawTombstones = rawRows.stream().filter(row -> row.get("payload") == null).toList();
        assertThat(rawTombstones).singleElement().satisfies(row -> assertThat(row).containsKey("payload"));
    }

    @Test
    void aQueryDeleteReturningTheDocuments_writesADeletedRowForEach() {
        widgetRepository.saveAll(List.of(widget("Printer"), widget("Printer"), widget("Scanner")));

        List<Widget> deleted = widgetRepository.purgeByQuery("Printer");

        assertThat(deleted).hasSize(2);
        assertThat(deletedRows()).hasSize(2).allSatisfy(row -> assertThat(row.getPayload()).containsEntry("event", null));
        assertThat(tombstoneRows()).hasSize(2);
        assertThat(widgetRepository.count()).isEqualTo(1);
    }

    @Test
    void aFind_writesNothing() {
        widgetRepository.save(widget("Printer"));

        widgetRepository.findByName("Printer");
        widgetRepository.findAll();

        assertThat(outboxCount()).isEqualTo(1);
    }

    @Test
    void aCustomFindAndModify_publishesTheReturnedDocument() {
        Widget saved = widgetRepository.save(widget("Printer"));

        widgetRepository.renameOne(saved.getId(), "Scanner");

        assertThat(versionOf(rowNamed("Scanner"))).isEqualTo(1L);
    }

    @Test
    void aCustomUpdateMulti_publishesTheNamedDocuments() {
        widgetRepository.saveAll(List.of(widget("Printer"), widget("Scanner")));

        long modified = widgetRepository.renameAllOfTenant("tenant-1", "Renamed");

        assertThat(modified).isEqualTo(2);
        assertThat(rowsNamed("Renamed")).hasSize(2).allSatisfy(row -> assertThat(versionOf(row)).isEqualTo(1L));
    }

    @Test
    void aCustomRemove_publishesTheRemovedDocuments() {
        widgetRepository.saveAll(List.of(widget("Printer"), widget("Printer")));

        widgetRepository.purgeNamed("Printer");

        assertThat(deletedRows()).hasSize(2);
    }

    @Test
    void aPlainTemplateWrite_isNotPublished() {
        Widget saved = widgetRepository.save(widget("Printer"));
        Query byId = Query.query(Criteria.where("id").is(saved.getId()));

        mongoTemplate.updateFirst(byId, new Update().set("name", "Scanner"), Widget.class);

        assertThat(outboxCount()).isEqualTo(1);
    }

    @Test
    void publishOff_writesWithoutARow() {
        doReturn(false).when(publishedAggregateTopics).isPublishing("organizations");

        Widget saved = widgetRepository.save(widget("Printer"));
        widgetRepository.renameOne(saved.getId(), "Scanner");
        widgetRepository.deleteById(saved.getId());

        assertThat(outboxCount()).isZero();
    }

    @Test
    void publishOff_everyOtherWriteAndDelete_runsWithoutARow() {
        doReturn(false).when(publishedAggregateTopics).isPublishing("organizations");
        List<Widget> saved = widgetRepository.saveAll(List.of(widget("Printer"), widget("Scanner"), widget("Router")));
        widgetRepository.insert(List.of(widget("Printer"), widget("Scanner"), widget("Router")));

        widgetRepository.delete(saved.get(0));
        widgetRepository.deleteAllById(List.of(saved.get(1).getId()));
        widgetRepository.deleteAll(List.of(saved.get(2)));
        List<Widget> deletedByName = widgetRepository.deleteByName("Printer");
        List<Widget> deletedByQuery = widgetRepository.purgeByQuery("Scanner");

        assertThat(deletedByName).hasSize(1);
        assertThat(deletedByQuery).hasSize(1);
        assertThat(widgetRepository.findAll()).extracting(Widget::getName).containsExactly("Router");
        assertThat(outboxCount()).isZero();
    }

    @Test
    void aNullArgumentToABaseDelete_isRefusedBySpringData_asWithoutPublishing() {
        assertThatThrownBy(() -> widgetRepository.deleteById(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> widgetRepository.deleteAllById(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> widgetRepository.delete(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> widgetRepository.deleteAll((Iterable<Widget>) null)).isInstanceOf(IllegalArgumentException.class);

        assertThat(outboxCount()).isZero();
    }

    private List<OutboxEvent> outboxRows() {
        return mongoTemplate.findAll(OutboxEvent.class);
    }

    private long outboxCount() {
        return mongoTemplate.count(new Query(), OutboxEvent.class);
    }

    // The delete envelopes; each has a tombstone row right after it.
    private List<OutboxEvent> deletedRows() {
        return outboxRows().stream()
                .filter(row -> row.getPayload() != null)
                .filter(PublishingRepositoryIT::isDeleted)
                .toList();
    }

    private List<OutboxEvent> tombstoneRows() {
        return outboxRows().stream().filter(row -> row.getPayload() == null).toList();
    }

    private List<OutboxEvent> rowsNamed(String name) {
        return outboxRows().stream()
                .filter(row -> row.getPayload() != null)
                .filter(row -> !isDeleted(row))
                .filter(row -> name.equals(eventOf(row).get("name")))
                .toList();
    }

    private static boolean isDeleted(OutboxEvent row) {
        return Boolean.TRUE.equals(row.getPayload().get("deleted"));
    }

    private static long versionOf(OutboxEvent row) {
        Number version = (Number) row.getPayload().get("version");
        return version.longValue();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> eventOf(OutboxEvent row) {
        return (Map<String, Object>) row.getPayload().get("event");
    }

    private OutboxEvent rowNamed(String name) {
        List<OutboxEvent> rows = rowsNamed(name);
        assertThat(rows).hasSize(1);
        return rows.getFirst();
    }

    private static Widget widget(String name) {
        return new Widget(null, "tenant-1", name, null, null);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableMongoRepositories(basePackageClasses = PublishingRepositoryIT.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE,
                    classes = WidgetRepository.class))
    @Import({WidgetSpec.class, CascadeLikeAspect.class})
    static class TestApplication {
    }
}
