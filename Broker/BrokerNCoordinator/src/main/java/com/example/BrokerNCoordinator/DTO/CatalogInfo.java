package com.example.BrokerNCoordinator.DTO;

import com.example.BrokerNCoordinator.DataModel.Enum.CatalogType;

import java.util.List;

public class CatalogInfo {
    public Integer catalogId;
    public String catalogDescription;
    public Integer supplierId;
    public CatalogType catalogType;
    public List<ItemInfo> items;
}
