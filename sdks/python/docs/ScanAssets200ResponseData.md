# ScanAssets200ResponseData


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**assets** | [**List[ScanAssets200ResponseDataAssetsInner]**](ScanAssets200ResponseDataAssetsInner.md) |  | [optional] 
**total** | **int** |  | [optional] 
**page** | **int** |  | [optional] 
**limit** | **int** |  | [optional] 
**provider** | **str** |  | [optional] 

## Example

```python
from sipher_client.models.scan_assets200_response_data import ScanAssets200ResponseData

# TODO update the JSON string below
json = "{}"
# create an instance of ScanAssets200ResponseData from a JSON string
scan_assets200_response_data_instance = ScanAssets200ResponseData.from_json(json)
# print the JSON string representation of the object
print(ScanAssets200ResponseData.to_json())

# convert the object into a dict
scan_assets200_response_data_dict = scan_assets200_response_data_instance.to_dict()
# create an instance of ScanAssets200ResponseData from a dict
scan_assets200_response_data_from_dict = ScanAssets200ResponseData.from_dict(scan_assets200_response_data_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


