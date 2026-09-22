package com.openframe.external.mapper;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.lang.reflect.Modifier;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BaseRestMapperTest {

    @Test
    void baseIsAbstractSoOnlyConcreteMappersBecomeBeans() {
        assertTrue(Modifier.isAbstract(BaseRestMapper.class.getModifiers()));
    }

    @Test
    void trivialSubclassNeedsNoCollaborators() {
        BaseRestMapper mapper = new BaseRestMapper() {
        };

        assertInstanceOf(BaseRestMapper.class, mapper);
    }

    @ParameterizedTest
    @ValueSource(classes = {CustomerMapper.class, DeviceMapper.class, KnowledgeBaseMapper.class,
            LogMapper.class, TicketMapper.class})
    void resourceMappersShareTheBase(Class<?> mapperType) {
        assertTrue(BaseRestMapper.class.isAssignableFrom(mapperType));
    }
}
