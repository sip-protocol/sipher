# ViewingKeyVerifyHierarchyRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ParentKey** | [**ViewingKey**](ViewingKey.md) |  | 
**ChildKey** | [**ViewingKey**](ViewingKey.md) |  | 
**ChildPath** | **string** |  | 

## Methods

### NewViewingKeyVerifyHierarchyRequest

`func NewViewingKeyVerifyHierarchyRequest(parentKey ViewingKey, childKey ViewingKey, childPath string, ) *ViewingKeyVerifyHierarchyRequest`

NewViewingKeyVerifyHierarchyRequest instantiates a new ViewingKeyVerifyHierarchyRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewViewingKeyVerifyHierarchyRequestWithDefaults

`func NewViewingKeyVerifyHierarchyRequestWithDefaults() *ViewingKeyVerifyHierarchyRequest`

NewViewingKeyVerifyHierarchyRequestWithDefaults instantiates a new ViewingKeyVerifyHierarchyRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetParentKey

`func (o *ViewingKeyVerifyHierarchyRequest) GetParentKey() ViewingKey`

GetParentKey returns the ParentKey field if non-nil, zero value otherwise.

### GetParentKeyOk

`func (o *ViewingKeyVerifyHierarchyRequest) GetParentKeyOk() (*ViewingKey, bool)`

GetParentKeyOk returns a tuple with the ParentKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetParentKey

`func (o *ViewingKeyVerifyHierarchyRequest) SetParentKey(v ViewingKey)`

SetParentKey sets ParentKey field to given value.


### GetChildKey

`func (o *ViewingKeyVerifyHierarchyRequest) GetChildKey() ViewingKey`

GetChildKey returns the ChildKey field if non-nil, zero value otherwise.

### GetChildKeyOk

`func (o *ViewingKeyVerifyHierarchyRequest) GetChildKeyOk() (*ViewingKey, bool)`

GetChildKeyOk returns a tuple with the ChildKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChildKey

`func (o *ViewingKeyVerifyHierarchyRequest) SetChildKey(v ViewingKey)`

SetChildKey sets ChildKey field to given value.


### GetChildPath

`func (o *ViewingKeyVerifyHierarchyRequest) GetChildPath() string`

GetChildPath returns the ChildPath field if non-nil, zero value otherwise.

### GetChildPathOk

`func (o *ViewingKeyVerifyHierarchyRequest) GetChildPathOk() (*string, bool)`

GetChildPathOk returns a tuple with the ChildPath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChildPath

`func (o *ViewingKeyVerifyHierarchyRequest) SetChildPath(v string)`

SetChildPath sets ChildPath field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


