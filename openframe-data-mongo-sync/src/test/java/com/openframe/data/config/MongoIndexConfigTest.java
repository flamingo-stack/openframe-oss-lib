package com.openframe.data.config;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.IndexDefinition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class MongoIndexConfigTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS) private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<IndexDefinition> indexCaptor;

    @InjectMocks private MongoIndexConfig mongoIndexConfig;

    @Test
    void initIndexes_deviceOsStates_uniqueIndexCreatedWithTheNameAndKeysOfTheOneOnTheDocument() {
        // setup
        CompoundIndex onTheDocument = DeviceOsState.class.getAnnotation(CompoundIndex.class);
        Document expectedKeys = Document.parse(onTheDocument.def());
        Document expectedOptions = new Document("name", onTheDocument.name()).append("unique", true);

        // execution
        mongoIndexConfig.initIndexes();

        // verifications
        verify(mongoTemplate.indexOps("device_os_states")).ensureIndex(indexCaptor.capture());
        assertThat(indexCaptor.getValue().getIndexKeys()).isEqualTo(expectedKeys);
        assertThat(indexCaptor.getValue().getIndexOptions()).isEqualTo(expectedOptions);
    }
}
