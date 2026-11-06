package com.openframe.publishing.repository;

import com.openframe.publishing.fixture.Widgets.Widget;

import java.util.List;

public interface WidgetCustomRepository {

    Widget renameOne(String id, String name);

    long renameAllOfTenant(String tenantId, String name);

    List<Widget> purgeNamed(String name);
}
