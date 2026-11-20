package com.openframe.data.document.rmm.osupdate;

import com.openframe.data.config.MongoConversionsContributor;
import com.openframe.data.config.MongoCustomConversionsConfig;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DeviceOsUpdateCategoryTest {

    private static final String CATEGORY_ID = "0fa1201d-4330-4fa8-8ae9-b877473b6441";
    private static final String CATEGORY_NAME = "Security Updates";

    private MappingMongoConverter converter;

    @BeforeEach
    void setUp() {
        MongoCustomConversions conversions = new MongoCustomConversionsConfig()
                .mongoCustomConversions(new DefaultListableBeanFactory().getBeanProvider(MongoConversionsContributor.class));
        MongoMappingContext mappingContext = new MongoMappingContext();
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        mappingContext.afterPropertiesSet();
        converter = new MappingMongoConverter(NoOpDbRefResolver.INSTANCE, mappingContext);
        converter.setCustomConversions(conversions);
        converter.afterPropertiesSet();
    }

    @Test
    void write_updateWithACategory_categoryStoredAsIdAndName() {
        // setup
        DeviceOsUpdateCategory category = DeviceOsUpdateCategory.builder().id(CATEGORY_ID).name(CATEGORY_NAME).build();
        DeviceOsUpdate update = DeviceOsUpdate.builder().updateKey("k-1").categories(List.of(category)).build();
        Document stored = new Document();
        Document expectedCategory = new Document("id", CATEGORY_ID).append("name", CATEGORY_NAME);

        // execution
        converter.write(update, stored);

        // verifications
        assertThat(stored.getList("categories", Document.class)).containsExactly(expectedCategory);
    }

    @Test
    void read_storedCategory_idAndNameRestored() {
        // setup
        Document storedCategory = new Document("id", CATEGORY_ID).append("name", CATEGORY_NAME);
        Document stored = new Document("updateKey", "k-1").append("categories", List.of(storedCategory));
        DeviceOsUpdateCategory expected = DeviceOsUpdateCategory.builder().id(CATEGORY_ID).name(CATEGORY_NAME).build();

        // execution
        DeviceOsUpdate update = converter.read(DeviceOsUpdate.class, stored);

        // verifications
        assertThat(update.getCategories()).containsExactly(expected);
    }
}
