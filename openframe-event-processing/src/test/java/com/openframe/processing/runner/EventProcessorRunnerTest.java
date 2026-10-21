package com.openframe.processing.runner;

import com.mongodb.MongoNotPrimaryException;
import com.mongodb.ServerAddress;
import com.openframe.processing.api.EventProcessor;
import com.openframe.processing.config.EventProcessingAutoConfiguration;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.exception.MongoUnavailableException;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedEvent;
import com.openframe.publishing.api.PublishedRecord;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.bson.BsonDocument;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.assertj.AssertableApplicationContext;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.UncategorizedMongoDbException;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Through EventProcessingAutoConfiguration: real registry, modes and metrics; processors that record what reached them.
class EventProcessorRunnerTest {

    private static final PublishedAggregateType ORGANIZATIONS = PublishedAggregateType.ORGANIZATIONS;
    private static final String ON_TICKETS = "widget-on-tickets";
    private static final String ON_INDEX = "widget-on-index";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventProcessingAutoConfiguration.class))
            .withPropertyValues("openframe.events.processing.enabled=true")
            .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
            .withBean("onTickets", EventProcessor.class, () -> new RecordingProcessor(ON_TICKETS, event -> { }))
            .withBean("onIndex", EventProcessor.class, () -> new RecordingProcessor(ON_INDEX, event -> { }));

    @Test
    void anEvent_reachesEveryProcessorOnEvents_withTheEnvelopesTenantAndVersion() {
        runner.withPropertyValues(onEvents(ON_TICKETS), onEvents(ON_INDEX)).run(context -> {
            process(context, record(false));

            assertThat(processor(context, ON_TICKETS).records).singleElement().satisfies(applied -> {
                assertThat(applied.getTenantId()).isEqualTo("tenant-1");
                assertThat(applied.getVersion()).isEqualTo(3L);
            });
            assertThat(processor(context, ON_INDEX).records).hasSize(1);
        });
    }

    @Test
    void aProcessorOnAspect_isSkipped() {
        runner.withPropertyValues(onEvents(ON_TICKETS)).run(context -> {
            process(context, record(false));

            assertThat(processor(context, ON_TICKETS).records).hasSize(1);
            assertThat(processor(context, ON_INDEX).records).isEmpty();
        });
    }

    @Test
    void aProcessorOnBoth_runs() {
        runner.withPropertyValues("openframe.events.processing.processors." + ON_TICKETS + ".mode=both").run(context -> {
            process(context, record(false));

            assertThat(processor(context, ON_TICKETS).records).hasSize(1);
        });
    }

    @Test
    void aDelete_reachesNoProcessor() {
        runner.withPropertyValues(onEvents(ON_TICKETS), onEvents(ON_INDEX)).run(context -> {
            process(context, record(true));

            assertThat(processor(context, ON_TICKETS).records).isEmpty();
            assertThat(processor(context, ON_INDEX).records).isEmpty();
        });
    }

    @Test
    void aFailingProcessor_doesNotStopTheOthers_andIsNamedInTheExceptionAfterwards() {
        runner.withBean("failing", EventProcessor.class, () -> new RecordingProcessor("widget-failing", event -> {
                    throw new IllegalStateException("bug");
                }))
                .withPropertyValues(onEvents(ON_TICKETS), onEvents(ON_INDEX), onEvents("widget-failing"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("[widget-failing]");
                    assertThat(processor(context, ON_TICKETS).records).hasSize(1);
                    assertThat(processor(context, ON_INDEX).records).hasSize(1);
                    assertThat(timerCount(context, "widget-failing", EventProcessingMetrics.OUTCOME_FAILED)).isEqualTo(1);
                    assertThat(timerCount(context, ON_TICKETS, EventProcessingMetrics.OUTCOME_APPLIED)).isEqualTo(1);
                    MeterRegistry meters = context.getBean(MeterRegistry.class);
                    double rows = meters.get("openframe.events.processing.rows").tag("processor", ON_TICKETS).counter().count();
                    assertThat(rows).isEqualTo(2.0);
                });
    }

    @Test
    void twoFailingProcessors_areBothNamed_andBothStackTracesAreKept() {
        IllegalStateException first = new IllegalStateException("first bug");
        IllegalStateException second = new IllegalStateException("second bug");
        runner.withBean("failingFirst", EventProcessor.class, () -> new RecordingProcessor("widget-first", event -> {
                    throw first;
                }))
                .withBean("failingSecond", EventProcessor.class, () -> new RecordingProcessor("widget-second", event -> {
                    throw second;
                }))
                .withPropertyValues(onEvents("widget-first"), onEvents("widget-second"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("widget-first")
                            .hasMessageContaining("widget-second")
                            .satisfies(failure -> {
                                Throwable[] suppressed = failure.getSuppressed();
                                Throwable cause = failure.getCause();
                                assertThat(List.of(cause, suppressed[0])).containsExactlyInAnyOrder(first, second);
                            });
                });
    }

    @Test
    void aWriteConflict_isAFailureOfItsProcessor_notMongoDown() {
        runner.withBean("conflict", EventProcessor.class, () -> new RecordingProcessor("widget-conflict", event -> {
                    throw new OptimisticLockingFailureException("write conflict");
                }))
                .withPropertyValues(onEvents(ON_TICKETS), onEvents("widget-conflict"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("[widget-conflict]");
                    assertThat(processor(context, ON_TICKETS).records).hasSize(1);
                    assertThat(timerCount(context, "widget-conflict", EventProcessingMetrics.OUTCOME_FAILED)).isEqualTo(1);
                });
    }

    @Test
    void mongoUnavailable_isRethrownForTheWholeEvent() {
        runner.withBean("mongoDown", EventProcessor.class, () -> new RecordingProcessor("widget-mongo-down", event -> {
                    throw new DataAccessResourceFailureException("Mongo unavailable");
                }))
                .withPropertyValues(onEvents("widget-mongo-down"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .isInstanceOf(MongoUnavailableException.class)
                            .hasCauseInstanceOf(DataAccessResourceFailureException.class);
                    long mongoUnavailable = timerCount(context, "widget-mongo-down", EventProcessingMetrics.OUTCOME_MONGO_UNAVAILABLE);
                    assertThat(mongoUnavailable).isEqualTo(1);
                });
    }

    @Test
    void aMongoFailover_isMongoDown_evenWhenSpringTranslatesItToAnUncategorizedError() {
        MongoNotPrimaryException notPrimary = new MongoNotPrimaryException(new BsonDocument(), new ServerAddress());
        runner.withBean("failover", EventProcessor.class, () -> new RecordingProcessor("widget-failover", event -> {
                    throw new UncategorizedMongoDbException("not primary", notPrimary);
                }))
                .withPropertyValues(onEvents("widget-failover"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record)).isInstanceOf(MongoUnavailableException.class);
                });
    }

    @Test
    void aProcessorsError_isItsFailure_andTheOthersStillRun() {
        runner.withBean("overflow", EventProcessor.class, () -> new RecordingProcessor("widget-overflow", event -> {
                    throw new StackOverflowError("deep");
                }))
                .withPropertyValues(onEvents(ON_TICKETS), onEvents("widget-overflow"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .isInstanceOf(EventProcessingFailedException.class)
                            .hasMessageContaining("[widget-overflow]")
                            .hasCauseInstanceOf(StackOverflowError.class);
                    assertThat(processor(context, ON_TICKETS).records).hasSize(1);
                });
    }

    @Test
    void aSchemaVersionNewerThanThisBuild_isRefused_beforeAnyProcessorRuns() {
        runner.withPropertyValues(onEvents(ON_TICKETS)).run(context -> {
            PublishedRecord<WidgetEvent> record = PublishedRecord.<WidgetEvent>builder()
                    .tenantId("tenant-1")
                    .version(3L)
                    .schemaVersion(PublishedRecord.CURRENT_SCHEMA_VERSION + 1)
                    .event(new WidgetEvent())
                    .build();

            assertThatThrownBy(() -> process(context, record))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("newer than the supported");
            assertThat(processor(context, ON_TICKETS).records).isEmpty();
        });
    }

    @Test
    void theProcessorsRunInNameOrder_soTheFirstFailureIsTheSameOnEveryPod() {
        IllegalStateException alpha = new IllegalStateException("alpha");
        IllegalStateException zulu = new IllegalStateException("zulu");
        runner.withBean("zulu", EventProcessor.class, () -> new RecordingProcessor("widget-zulu", event -> {
                    throw zulu;
                }))
                .withBean("alpha", EventProcessor.class, () -> new RecordingProcessor("widget-alpha", event -> {
                    throw alpha;
                }))
                .withPropertyValues(onEvents("widget-zulu"), onEvents("widget-alpha"))
                .run(context -> {
                    PublishedRecord<WidgetEvent> record = record(false);

                    assertThatThrownBy(() -> process(context, record))
                            .hasMessageContaining("[widget-alpha, widget-zulu]")
                            .hasCause(alpha);
                });
    }

    private void process(AssertableApplicationContext context, PublishedRecord<WidgetEvent> record) {
        EventProcessorRunner processorRunner = context.getBean(EventProcessorRunner.class);
        processorRunner.process(ORGANIZATIONS, "organization-document-1", record);
    }

    private static RecordingProcessor processor(AssertableApplicationContext context, String name) {
        return context.getBeansOfType(RecordingProcessor.class).values().stream()
                .filter(processor -> processor.name().equals(name))
                .findFirst()
                .orElseThrow();
    }

    private static long timerCount(AssertableApplicationContext context, String processorName, String outcome) {
        MeterRegistry registry = context.getBean(MeterRegistry.class);
        return registry.get("openframe.events.processing.apply")
                .tag("processor", processorName)
                .tag("outcome", outcome)
                .timer()
                .count();
    }

    private static String onEvents(String processorName) {
        return "openframe.events.processing.processors." + processorName + ".mode=events";
    }

    private static PublishedRecord<WidgetEvent> record(boolean deleted) {
        WidgetEvent event = deleted ? null : new WidgetEvent();
        return PublishedRecord.<WidgetEvent>builder()
                .tenantId("tenant-1")
                .version(3L)
                .deleted(deleted)
                .schemaVersion(1)
                .event(event)
                .build();
    }

    static class WidgetEvent implements PublishedEvent {
    }

    static class RecordingProcessor implements EventProcessor<WidgetEvent> {

        private final String name;
        private final Consumer<WidgetEvent> behaviour;
        final List<PublishedRecord<WidgetEvent>> records = new ArrayList<>();

        RecordingProcessor(String name, Consumer<WidgetEvent> behaviour) {
            this.name = name;
            this.behaviour = behaviour;
        }

        @Override
        public String name() {
            return name;
        }

        @Override
        public PublishedAggregateType getType() {
            return ORGANIZATIONS;
        }

        @Override
        public long process(PublishedRecord<WidgetEvent> record) {
            WidgetEvent event = record.getEvent();
            behaviour.accept(event);
            records.add(record);
            return 2;
        }
    }
}
