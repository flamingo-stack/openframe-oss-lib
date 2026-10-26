package com.openframe.publishing.repository;

import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import com.openframe.publishing.config.EventsAutoConfiguration;
import com.openframe.publishing.config.EventsConfiguration;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import com.openframe.publishing.config.OutboxIndexAutoConfiguration;
import com.openframe.publishing.fixture.Widgets.UnversionedWidget;
import com.openframe.publishing.fixture.Widgets.UnversionedWidgetSpec;
import com.openframe.publishing.fixture.Widgets.Widget;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.persistence.OutboxIndexInitializer;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.aop.framework.Advised;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoAutoConfiguration;
import org.springframework.boot.test.context.assertj.AssertableApplicationContext;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.ContextConsumer;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

import static org.assertj.core.api.Assertions.assertThat;

// Through OutboxAutoConfiguration, as a service loads it. No Mongo is needed: repositories are created without a connection.
@ExtendWith(OutputCaptureExtension.class)
class PublishingRepositoryStartupTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(MongoAutoConfiguration.class, DataMongoAutoConfiguration.class,
                    AggregateSpecAutoConfiguration.class, EventsAutoConfiguration.class, OutboxAutoConfiguration.class))
            .withPropertyValues("spring.mongodb.uri=mongodb://localhost:1/startup-test", "spring.data.mongodb.enabled=true",
                    "openframe.events.enabled=true");

    @Test
    void aRepositoryWithItsSpecBean_starts() {
        runner.withUserConfiguration(WidgetRepositories.class)
                .withBean(WidgetSpec.class)
                .run(context -> assertThat(context).hasNotFailed().hasSingleBean(WidgetRepository.class));
    }

    @Test
    void aTypeSwitchedOn_logsThatItsRepositoryPublishesIt(CapturedOutput output) {
        runner.withUserConfiguration(WidgetRepositories.class)
                .withBean(WidgetSpec.class)
                .withPropertyValues("openframe.events.topics.organizations.enabled=true")
                .run(context -> assertThat(context).hasNotFailed());

        assertThat(output).contains("WidgetRepository] publish organizations");
    }

    @Test
    void aTypeSwitchedOff_logsThatItsRepositoryPublishesNothing(CapturedOutput output) {
        runner.withUserConfiguration(WidgetRepositories.class)
                .withBean(WidgetSpec.class)
                .run(context -> assertThat(context).hasNotFailed());

        assertThat(output).contains("WidgetRepository] publish no organizations writes")
                .doesNotContain("WidgetRepository] publish organizations");
    }

    // Shaped like saas-infra: Mongo on, only its own repositories, no spec at all.
    @Test
    void aServiceWithOnlyItsOwnRepositories_starts() {
        runner.withUserConfiguration(OwnRepositoriesOnly.class)
                .run(context -> assertThat(context).hasNotFailed().hasSingleBean(OutboxPublisher.class));
    }

    @Test
    void publishingSwitchedOff_leavesAPlainRepository_andNoPublishingBeans() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(MongoAutoConfiguration.class, DataMongoAutoConfiguration.class,
                        AggregateSpecAutoConfiguration.class, EventsAutoConfiguration.class, OutboxAutoConfiguration.class,
                        OutboxIndexAutoConfiguration.class))
                .withPropertyValues("spring.mongodb.uri=mongodb://localhost:1/startup-test", "spring.data.mongodb.enabled=true")
                .withUserConfiguration(UnversionedWidgetRepositories.class)
                .run(context -> {
                    assertThat(context).hasNotFailed()
                            .doesNotHaveBean(OutboxPublisher.class)
                            .doesNotHaveBean(PublishingRepositoryPostProcessor.class)
                            .doesNotHaveBean(PublishingRepositoryStartupCheck.class)
                            .doesNotHaveBean(OutboxIndexInitializer.class);
                    Object repository = context.getBean(UnversionedWidgetRepository.class);
                    assertThat(repository).isInstanceOfSatisfying(Advised.class, advised -> assertThat(advised.getAdvisors())
                            .noneMatch(advisor -> advisor.getAdvice() instanceof PublishingRepositoryInterceptor));
                });
    }

    @Test
    void aPublishingRepositoryWithoutTheInterceptor_stopsTheServiceFromStarting() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(MongoAutoConfiguration.class, DataMongoAutoConfiguration.class))
                .withPropertyValues("spring.mongodb.uri=mongodb://localhost:1/startup-test")
                .withUserConfiguration(WithoutPostProcessor.class, WidgetRepositories.class)
                .withBean(WidgetSpec.class)
                .run(failsWith("has no PublishingRepositoryInterceptor"));
    }

    @Test
    void aRepositoryWhoseDocumentHasNoSpec_staysAPlainRepository() {
        runner.withUserConfiguration(OwnRepositoriesOnly.class)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    Object repository = context.getBean(PlainWidgetRepository.class);
                    assertThat(repository).isInstanceOfSatisfying(Advised.class, advised -> assertThat(advised.getAdvisors())
                            .noneMatch(advisor -> advisor.getAdvice() instanceof PublishingRepositoryInterceptor));
                });
    }

    @Test
    void aRepositoryWhoseDocumentHasASpec_getsTheInterceptor_withoutAnyMarker() {
        runner.withUserConfiguration(WidgetRepositories.class)
                .withBean(WidgetSpec.class)
                .run(context -> {
                    Object repository = context.getBean(WidgetRepository.class);
                    assertThat(repository).isInstanceOfSatisfying(Advised.class, advised -> assertThat(advised.getAdvisors())
                            .anyMatch(advisor -> advisor.getAdvice() instanceof PublishingRepositoryInterceptor));
                });
    }

    @Test
    void aSpecWhoseDocumentHasNoRepository_starts_asTheSharedStreamDoesWithoutTicketRepository() {
        runner.withBean(WidgetSpec.class)
                .run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    void twoRepositoriesOfOnePublishedDocument_stopTheServiceFromStarting() {
        runner.withUserConfiguration(WidgetRepositories.class, OwnRepositoriesOnly.class)
                .withBean(WidgetSpec.class)
                .run(failsWith("must have at most one repository"));
    }

    @Test
    void aDocumentWithoutVersion_stopsTheServiceFromStarting() {
        runner.withUserConfiguration(UnversionedWidgetRepositories.class)
                .withBean(UnversionedWidgetSpec.class)
                .run(failsWith("no @Version"));
    }

    @Test
    void anUpdateMethod_stopsTheServiceFromStarting() {
        runner.withUserConfiguration(UpdateMethodRepositories.class)
                .withBean(WidgetSpec.class)
                .run(failsWith("@Update method"));
    }

    @Test
    void aDeleteReturningACount_stopsTheServiceFromStarting() {
        runner.withUserConfiguration(CountingDeleteRepositories.class)
                .withBean(WidgetSpec.class)
                .run(failsWith("deletes but returns long"));
    }

    @Test
    void aCustomMethodNamedLikeADelete_isNotIntercepted_soTheServiceStarts() {
        runner.withUserConfiguration(CustomDeleteRepositories.class)
                .withBean(WidgetSpec.class)
                .run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    void aPublishingMarkerOnACustomMethod_stopsTheServiceFromStarting() {
        runner.withUserConfiguration(MarkedRepositories.class)
                .withBean(WidgetSpec.class)
                .run(failsWith("carries a publishing marker"));
    }

    private static ContextConsumer<AssertableApplicationContext> failsWith(String message) {
        return context -> {
            assertThat(context).hasFailed();
            Throwable cause = NestedExceptionUtils.getMostSpecificCause(context.getStartupFailure());
            assertThat(cause.getMessage()).contains(message);
        };
    }

    // Everything of OutboxAutoConfiguration except PublishingRepositoryPostProcessor.
    @Configuration
    @Import({EventsAutoConfiguration.class, EventsConfiguration.class, OutboxPublisher.class,
            AggregateSpecRegistry.class, PublishingRepositoryStartupCheck.class})
    static class WithoutPostProcessor {
    }

    @Configuration
    @EnableMongoRepositories(basePackageClasses = PublishingRepositoryStartupTest.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = PlainWidgetRepository.class))
    static class OwnRepositoriesOnly {
    }

    @Configuration
    @EnableMongoRepositories(basePackageClasses = PublishingRepositoryStartupTest.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = WidgetRepository.class))
    static class WidgetRepositories {
    }

    @Configuration
    @EnableMongoRepositories(basePackageClasses = PublishingRepositoryStartupTest.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = UnversionedWidgetRepository.class))
    static class UnversionedWidgetRepositories {
    }

    @Configuration
    @EnableMongoRepositories(basePackageClasses = PublishingRepositoryStartupTest.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = UpdateMethodRepository.class))
    static class UpdateMethodRepositories {
    }

    @Configuration
    @EnableMongoRepositories(basePackageClasses = PublishingRepositoryStartupTest.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = CountingDeleteRepository.class))
    static class CountingDeleteRepositories {
    }

    @Configuration
    @EnableMongoRepositories(basePackageClasses = PublishingRepositoryStartupTest.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = CustomDeleteRepository.class))
    static class CustomDeleteRepositories {
    }

    @Configuration
    @EnableMongoRepositories(basePackageClasses = PublishingRepositoryStartupTest.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = MarkedRepository.class))
    static class MarkedRepositories {
    }

    interface PlainWidgetRepository extends MongoRepository<Widget, String> {
    }

    interface UnversionedWidgetRepository extends MongoRepository<UnversionedWidget, String> {
    }

    interface UpdateMethodRepository extends MongoRepository<Widget, String> {

        @org.springframework.data.mongodb.repository.Query("{ '_id': ?0 }")
        @Update("{ '$set': { 'name': ?1 } }")
        long renameById(String id, String name);
    }

    interface CountingDeleteRepository extends MongoRepository<Widget, String> {

        long deleteByName(String name);
    }

    interface CustomDeleteRepository extends MongoRepository<Widget, String>, DeleteNamedFragment {
    }

    interface MarkedRepository extends MongoRepository<Widget, String>, MarkedFragment {
    }
}
