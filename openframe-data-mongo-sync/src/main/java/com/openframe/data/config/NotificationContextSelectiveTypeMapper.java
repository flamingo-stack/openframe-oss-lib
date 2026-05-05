package com.openframe.data.config;

import com.openframe.data.document.notification.NotificationContext;
import org.bson.conversions.Bson;
import org.springframework.data.mapping.context.MappingContext;
import org.springframework.data.mongodb.core.convert.DefaultMongoTypeMapper;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;
import org.springframework.data.util.TypeInformation;

/**
 * Suppresses {@code _class} for the {@link NotificationContext} hierarchy
 * (it uses its own {@code type} field as the discriminator). Other classes
 * fall through to default behaviour, so this mapper is safe to install
 * globally.
 */
public class NotificationContextSelectiveTypeMapper extends DefaultMongoTypeMapper {

    public NotificationContextSelectiveTypeMapper(
            MappingContext<? extends MongoPersistentEntity<?>, MongoPersistentProperty> mappingContext) {
        super(DefaultMongoTypeMapper.DEFAULT_TYPE_KEY, mappingContext);
    }

    @Override
    public void writeType(TypeInformation<?> info, Bson sink) {
        if (info != null && NotificationContext.class.isAssignableFrom(info.getType())) {
            return;
        }
        super.writeType(info, sink);
    }

    @Override
    public void writeType(Class<?> type, Bson sink) {
        if (type != null && NotificationContext.class.isAssignableFrom(type)) {
            return;
        }
        super.writeType(type, sink);
    }
}
