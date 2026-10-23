package com.openframe.data.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.function.context.FunctionCatalog;
import org.springframework.cloud.function.context.config.ContextFunctionCatalogAutoConfiguration;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.WritingConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;

class MongoConversionsContributorFunctionCatalogTest {

    private static final String CONTRIBUTOR_NAME = "toolCallArgumentsConversions";
    private static final String BUSINESS_CONSUMER_NAME = "businessEvents";

    private AnnotationConfigApplicationContext context;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext();
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    @Test
    void functionCatalog_onlyMongoContributor_doesNotDiscoverMessageConsumer() {
        // setup
        context.register(ContextFunctionCatalogAutoConfiguration.class, MongoCustomConversionsConfig.class,
                ContributorConfiguration.class);

        // execution
        context.refresh();

        // verifications
        FunctionCatalog catalog = context.getBean(FunctionCatalog.class);
        Set<String> names = catalog.getNames(Consumer.class);
        assertThat(names).doesNotContain(CONTRIBUTOR_NAME);
    }

    @Test
    void mongoCustomConversions_contributorPresent_registersConverter() {
        // setup
        context.register(ContextFunctionCatalogAutoConfiguration.class, MongoCustomConversionsConfig.class,
                ContributorConfiguration.class);

        // execution
        context.refresh();

        // verifications
        MongoCustomConversions conversions = context.getBean(MongoCustomConversions.class);
        boolean registered = conversions.hasCustomWriteTarget(MongoValue.class, String.class);
        assertThat(registered).isTrue();
    }

    @Test
    void functionCatalog_businessConsumerPresent_keepsConsumerInvocable() {
        // setup
        context.register(ContextFunctionCatalogAutoConfiguration.class, MongoCustomConversionsConfig.class,
                ContributorConfiguration.class, BusinessConsumerConfiguration.class);

        // execution
        context.refresh();
        FunctionCatalog catalog = context.getBean(FunctionCatalog.class);
        Consumer<String> consumer = catalog.lookup(Consumer.class, BUSINESS_CONSUMER_NAME);
        consumer.accept("received");

        // verifications
        BusinessEvents events = context.getBean(BusinessEvents.class);
        assertThat(events.get()).isEqualTo("received");
        Set<String> names = catalog.getNames(Consumer.class);
        assertThat(names).contains(BUSINESS_CONSUMER_NAME).doesNotContain(CONTRIBUTOR_NAME);
    }

    @Configuration(proxyBeanMethods = false)
    static class ContributorConfiguration {

        @Bean
        MongoConversionsContributor toolCallArgumentsConversions() {
            return adapter -> adapter.registerConverter(new MongoValueWriter());
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class BusinessConsumerConfiguration {

        @Bean
        BusinessEvents businessEventsStore() {
            return new BusinessEvents();
        }

        @Bean
        Consumer<String> businessEvents(BusinessEvents events) {
            return events::set;
        }
    }

    static class BusinessEvents extends AtomicReference<String> {
    }

    static class MongoValue {
    }

    @WritingConverter
    static class MongoValueWriter implements Converter<MongoValue, String> {

        @Override
        public String convert(MongoValue source) {
            return "stored";
        }
    }
}
