package com.example.BrokerNCoordinator.Service.Interface;

public interface ICatalogService {
//    requestCatalog (in catalogType, out catalogInfo)
//    requestSelection (in itemId, out itemInfo)
    public Object requestCatalog(Object catalogType);
    public Object requestSelection(Object itemId);
}
