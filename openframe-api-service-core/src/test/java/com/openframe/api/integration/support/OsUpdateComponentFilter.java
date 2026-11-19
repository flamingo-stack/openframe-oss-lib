package com.openframe.api.integration.support;

import org.springframework.core.type.AnnotationMetadata;
import org.springframework.core.type.classreading.MetadataReader;
import org.springframework.core.type.classreading.MetadataReaderFactory;
import org.springframework.core.type.filter.TypeFilter;
import org.springframework.stereotype.Component;

// Picks every Spring component of the OS-update feature by its name, so the acceptance test names no class of it.
public class OsUpdateComponentFilter implements TypeFilter {

    private static final String COMPONENT = Component.class.getName();

    @Override
    public boolean match(MetadataReader metadataReader, MetadataReaderFactory metadataReaderFactory) {
        String className = metadataReader.getClassMetadata().getClassName();
        AnnotationMetadata annotations = metadataReader.getAnnotationMetadata();
        boolean component = annotations.hasAnnotation(COMPONENT) || annotations.hasMetaAnnotation(COMPONENT);
        return component && className.contains("OsUpdate") && !className.contains(".integration.");
    }
}
