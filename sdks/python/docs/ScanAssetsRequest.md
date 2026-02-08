# ScanAssetsRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**address** | **str** | Base58-encoded Solana public key | 
**display_options** | [**ScanAssetsRequestDisplayOptions**](ScanAssetsRequestDisplayOptions.md) |  | [optional] 
**page** | **int** |  | [optional] [default to 1]
**limit** | **int** |  | [optional] [default to 100]

## Example

```python
from sipher_client.models.scan_assets_request import ScanAssetsRequest

# TODO update the JSON string below
json = "{}"
# create an instance of ScanAssetsRequest from a JSON string
scan_assets_request_instance = ScanAssetsRequest.from_json(json)
# print the JSON string representation of the object
print(ScanAssetsRequest.to_json())

# convert the object into a dict
scan_assets_request_dict = scan_assets_request_instance.to_dict()
# create an instance of ScanAssetsRequest from a dict
scan_assets_request_from_dict = ScanAssetsRequest.from_dict(scan_assets_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


