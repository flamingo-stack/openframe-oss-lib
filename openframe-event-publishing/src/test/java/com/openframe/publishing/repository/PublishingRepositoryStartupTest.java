package com.openframe.publishing.repository;

import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.api.PublishingMongoRepository;
import com.openframe.publishing.config.EventsConfiguration;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import com.openframe.publishing.config.OutboxIndexAutoConfiguration;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.fixture.Widgets.UnversionedWidget;
import com.openframe.publishing.fixture.Widgets.UnversionedWidgetSpec;
import com.openframe.publishing.fixture.Widgets.Widget;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.persistence.OutboxIndexInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.Advised;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoAutoConfiguration;
import org.springframework.boot.test.context.assertj.AssertableApplicationContext;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.context.runner.ContextConsumer;
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
class PublishingRepositoryStartupTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(MongoAutoConfiguration.class, DataMongoAutoConfiguration.class,
                    OutboxAutoConfiguration.class))
            .withPropertyValues("spring.mongodb.uri=mongodb://localhost:1/startup-test", "spring.data.mongodb.enabled=true",
                    "openframe.events.publishing.enabled=true");

    @Test
    void aRepositoryWithItsSpecBean_starts() {
        runner.withUserConfiguration(WidgetRepositories.class)
                .withBean(WidgetSpec.class)
                .run(context -> assertThat(context).hasNotFailed().hasSingleBean(WidgetRepository.class));
    }

    // Shaped like saas-infra: Mongo on, only its own repositories, no PublishingMongoRepository at all.
    @Test
    void aServiceWithOnlyItsOwnRepositories_starts() {
        runner.withUserConfiguration(OwnRepositoriesOnly.class)
                .run(context -> assertThat(context).hasNotFailed().hasSingleBean(OutboxPublisher.class));
    }

    @Test
    void publishingSwitchedOff_leavesAPlainRepository_andNoPublishingBeans() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(MongoAutoConfiguration.class, DataMongoAutoConfiguration.class,
                        OutboxAutoConfiguration.class, OutboxIndexAutoConfiguration.class))
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
    void aSpecClassThatIsNotABean_stopsTheServiceFromStarting() {
        runner.withUserConfiguration(WidgetRepositories.class)
                .run(failsWith(WidgetSpec.class.getName()));
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
    @Import({EventsConfiguration.class, PublishedAggregateTopics.class, OutboxPublisher.class,
            PublishedRepositorySpecs.class, PublishingRepositoryStartupCheck.class})
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

    interface UnversionedWidgetRepository extends PublishingMongoRepository<UnversionedWidget, String, UnversionedWidgetSpec> {
    }

    interface UpdateMethodRepository extends PublishingMongoRepository<Widget, String, WidgetSpec> {

        @org.springframework.data.mongodb.repository.Query("{ '_id': ?0 }")
        @Update("{ '$set': { 'name': ?1 } }")
        long renameById(String id, String name);
    }

    interface CountingDeleteRepository extends PublishingMongoRepository<Widget, String, WidgetSpec> {

        long deleteByName(String name);
    }

    interface CustomDeleteRepository extends PublishingMongoRepository<Widget, String, WidgetSpec>, DeleteNamedFragment {
    }

    interface MarkedRepository extends PublishingMongoRepository<Widget, String, WidgetSpec>, MarkedFragment {
    }
}
