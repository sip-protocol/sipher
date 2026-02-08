# ScanAssets200ResponseDataAssetsInner


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | [optional] 
**interface** | **str** |  | [optional] 
**token_info** | **object** |  | [optional] 
**ownership** | **object** |  | [optional] 

## Example

```python
from sipher_client.models.scan_assets200_response_data_assets_inner import ScanAssets200ResponseDataAssetsInner

# TODO update the JSON string below
json = "{}"
# create an instance of ScanAssets200ResponseDataAssetsInner from a JSON string
scan_assets200_response_data_assets_inner_instance = ScanAssets200ResponseDataAssetsInner.from_json(json)
# print the JSON string representation of the object
print(ScanAssets200ResponseDataAssetsInner.to_json())

# convert the object into a dict
scan_assets200_response_data_assets_inner_dict = scan_assets200_response_data_assets_inner_instance.to_dict()
# create an instance of ScanAssets200ResponseDataAssetsInner from a dict
scan_assets200_response_data_assets_inner_from_dict = ScanAssets200ResponseDataAssetsInner.from_dict(scan_assets200_response_data_assets_inner_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


