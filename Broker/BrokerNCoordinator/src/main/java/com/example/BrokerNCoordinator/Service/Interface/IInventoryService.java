package com.example.BrokerNCoordinator.Service.Interface;

import com.example.BrokerNCoordinator.DTO.InventoryStatus;

public interface IInventoryService {

    InventoryStatus checkInventory(Integer itemId);

    void update(Integer itemId, Integer amount);

    void reserveInventory(Integer itemId, Integer amount);

    void commitInventory(Integer itemId, Integer amount);

    void abortInventory(Integer itemId, Integer amount);

}