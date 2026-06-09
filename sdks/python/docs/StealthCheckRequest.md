# StealthCheckRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**stealth_address** | [**StealthAddress**](StealthAddress.md) |  | 
**viewing_private_key** | **str** | 0x-prefixed 32-byte hex string | 
**spending_public_key** | **str** | 0x-prefixed 32-byte hex string | 

## Example

```python
from sipher_client.models.stealth_check_request import StealthCheckRequest

# TODO update the JSON string below
json = "{}"
# create an instance of StealthCheckRequest from a JSON string
stealth_check_request_instance = StealthCheckRequest.from_json(json)
# print the JSON string representation of the object
print(StealthCheckRequest.to_json())

# convert the object into a dict
stealth_check_request_dict = stealth_check_request_instance.to_dict()
# create an instance of StealthCheckRequest from a dict
stealth_check_request_from_dict = StealthCheckRequest.from_dict(stealth_check_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


