# ScanAssetsRequestDisplayOptions


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**show_fungible** | **bool** |  | [optional] [default to True]
**show_native_balance** | **bool** |  | [optional] [default to False]

## Example

```python
from sipher_client.models.scan_assets_request_display_options import ScanAssetsRequestDisplayOptions

# TODO update the JSON string below
json = "{}"
# create an instance of ScanAssetsRequestDisplayOptions from a JSON string
scan_assets_request_display_options_instance = ScanAssetsRequestDisplayOptions.from_json(json)
# print the JSON string representation of the object
print(ScanAssetsRequestDisplayOptions.to_json())

# convert the object into a dict
scan_assets_request_display_options_dict = scan_assets_request_display_options_instance.to_dict()
# create an instance of ScanAssetsRequestDisplayOptions from a dict
scan_assets_request_display_options_from_dict = ScanAssetsRequestDisplayOptions.from_dict(scan_assets_request_display_options_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


