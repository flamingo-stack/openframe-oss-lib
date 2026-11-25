package com.openframe.api.integration.support;

import org.springframework.core.type.AnnotationMetadata;
import org.springframework.core.type.classreading.MetadataReader;
import org.springframework.core.type.classreading.MetadataReaderFactory;
import org.springframework.core.type.filter.TypeFilter;
import org.springframework.stereotype.Component;

public class OsUpdateComponentFilter implements TypeFilter {

    private static final String COMPONENT = Component.class.getName();

    @Override
    public boolean match(MetadataReader metadataReader, MetadataReaderFactory metadataReaderFactory) {
        String className = metadataReader.getClassMetadata().getClassName();
        AnnotationMetadata annotations = metadataReader.getAnnotationMetadata();
        boolean component = annotations.hasAnnotation(COMPONENT) || annotations.hasMetaAnnotation(COMPONENT);
        return component && ofTheFeature(className) && !className.contains(".integration.");
    }

    private static boolean ofTheFeature(String className) {
        return className.contains("OsUpdate") || className.contains("DeviceOs") || className.contains("OsVersion")
                || className.contains(".osupdate.");
    }
}
